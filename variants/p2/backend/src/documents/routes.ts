import type { FastifyInstance, FastifyReply } from "fastify";
import PDFDocument from "pdfkit";
import { ApiError } from "../lib/errors.js";
import { requireAuth, currentUser } from "../auth/rbac.js";
import { loadPayment } from "../payments/orchestrator.js";
import { toPaymentDTO } from "../payments/mappers.js";
import { formatMinor } from "../lib/money.js";

function streamPdf(reply: FastifyReply, filename: string, build: (doc: PDFKit.PDFDocument) => void) {
  const doc = new PDFDocument({ margin: 50, size: "A4" });
  reply.header("Content-Type", "application/pdf");
  reply.header("Content-Disposition", `attachment; filename="${filename}"`);
  build(doc);
  doc.end();
  return reply.send(doc as unknown as NodeJS.ReadableStream);
}

export async function documentRoutes(app: FastifyInstance): Promise<void> {
  // GET /payments/:id/receipt.pdf
  app.get("/payments/:id/receipt.pdf", { preHandler: requireAuth }, async (req, reply) => {
    const me = currentUser(req);
    const { id } = req.params as { id: string };
    const raw = await loadPayment(id);
    if (me.role !== "ADMIN" && raw.companyId !== me.id && raw.freelancerId !== me.id) {
      throw ApiError.forbidden();
    }
    const p = toPaymentDTO(raw);
    return streamPdf(reply, `receipt-${p.id}.pdf`, (doc) => {
      doc.fontSize(20).text("GigBridge Payment Receipt", { align: "left" });
      doc.moveDown();
      doc.fontSize(10).fillColor("#555");
      doc.text(`Payment ID: ${p.id}`);
      doc.text(`Status: ${p.state}`);
      doc.moveDown().fillColor("#000").fontSize(12);
      doc.text(`Payer: ${p.payerName}`);
      doc.text(`Payee: ${p.payeeName}`);
      doc.text(`Amount sent: ${p.srcCurrency} ${formatMinor(p.srcAmountMinor)}`);
      doc.text(`Fee: ${p.feeAmountMinor != null ? p.srcCurrency + " " + formatMinor(p.feeAmountMinor) : "—"}`);
      doc.text(`Payee receives: ${p.dstAmountMinor != null ? p.dstCurrency + " " + formatMinor(p.dstAmountMinor) : "—"}`);
      doc.text(`Purpose code: ${p.purposeCode}`);
      doc.moveDown();
      if (p.txHashFund) doc.fontSize(9).text(`Fund tx: ${p.txHashFund}`);
      if (p.txHashRelease) doc.fontSize(9).text(`Release tx: ${p.txHashRelease}`);
    });
  });

  // GET /payments/:id/compliance.pdf
  app.get("/payments/:id/compliance.pdf", { preHandler: requireAuth }, async (req, reply) => {
    const me = currentUser(req);
    const { id } = req.params as { id: string };
    const raw = await loadPayment(id);
    if (me.role !== "ADMIN" && raw.companyId !== me.id && raw.freelancerId !== me.id) {
      throw ApiError.forbidden();
    }
    const p = toPaymentDTO(raw);
    return streamPdf(reply, `compliance-${p.id}.pdf`, (doc) => {
      doc.fontSize(20).text("GigBridge Compliance Report");
      doc.moveDown().fontSize(10).fillColor("#555").text(`Payment ${p.id}`);
      doc.moveDown().fillColor("#000").fontSize(12);
      doc.text(`Verdict: ${p.compliance?.verdict ?? "—"}`);
      if (p.compliance?.anchorTxHash) doc.fontSize(9).text(`Anchored: ${p.compliance.anchorTxHash}`);
      doc.moveDown().fontSize(12).text("Agent reasoning:");
      doc.fontSize(10).fillColor("#333").text(p.compliance?.agentExplanation ?? "—");
      doc.moveDown().fillColor("#000").fontSize(12).text("Rule results:");
      for (const r of p.compliance?.ruleResults ?? []) {
        doc
          .fontSize(9)
          .fillColor(r.triggered ? "#b00" : "#070")
          .text(`${r.triggered ? "✗" : "✓"} ${r.id} [${r.severity}] — ${r.message}`);
      }
    });
  });
}
