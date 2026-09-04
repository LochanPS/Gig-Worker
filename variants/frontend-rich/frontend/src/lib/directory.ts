// Demo directory of people. The mock API exposes no roster endpoint, so payee
// lists and company rosters read from here (same fixture IDs the backend seeds).
// See INTEGRATION_LOG.txt: needs GET /company/freelancers from P2.
import type { Currency, KycStatus, Role } from '@gigbridge/shared';

export interface DirectoryFreelancer {
  id: string;
  name: string;
  email: string;
  country: string;
  kycStatus: KycStatus;
  walletAddress: string | null;
  defaultCurrency: Currency;
}

export interface DirectoryCompany {
  id: string;
  name: string;
  email: string;
  country: string;
}

export const FREELANCERS: DirectoryFreelancer[] = [
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Priya Sharma',
    email: 'priya@demo.gg',
    country: 'IN',
    kycStatus: 'VERIFIED',
    walletAddress: '0xPriya00000000000000000000000000000003',
    defaultCurrency: 'INR',
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    name: 'Alex Carter',
    email: 'alex@demo.gg',
    country: 'US',
    kycStatus: 'VERIFIED',
    walletAddress: '0xAlex000000000000000000000000000000004',
    defaultCurrency: 'INR',
  },
  {
    id: '55555555-5555-5555-5555-555555555555',
    name: 'Uma Rao',
    email: 'uma@demo.gg',
    country: 'IN',
    kycStatus: 'PENDING',
    walletAddress: null,
    defaultCurrency: 'INR',
  },
];

export const COMPANIES: DirectoryCompany[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Novatek GmbH',
    email: 'novatek@demo.gg',
    country: 'DE',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Chennai Softworks',
    email: 'chennai@demo.gg',
    country: 'IN',
  },
];

const PEOPLE: Record<string, { name: string; country: string; role: Role }> = {};
for (const f of FREELANCERS) PEOPLE[f.id] = { name: f.name, country: f.country, role: 'FREELANCER' };
for (const c of COMPANIES) PEOPLE[c.id] = { name: c.name, country: c.country, role: 'COMPANY' };

export function personName(id: string | null | undefined): string {
  if (!id) return 'Unknown';
  return PEOPLE[id]?.name ?? 'Unknown party';
}

export function personCountry(id: string | null | undefined): string | null {
  if (!id) return null;
  return PEOPLE[id]?.country ?? null;
}

export function freelancerById(id: string | null | undefined): DirectoryFreelancer | undefined {
  return FREELANCERS.find((f) => f.id === id);
}

export function corridorOf(src: string, dst: string): string {
  return `${src} to ${dst}`;
}
