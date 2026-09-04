import type { User } from "@prisma/client";
import type { UserDTO } from "@gigbridge/shared";

export function toUserDTO(u: User): UserDTO {
  return {
    id: u.id,
    role: u.role,
    email: u.email,
    country: u.country,
    name: u.name,
    walletAddress: u.walletAddress,
    createdAt: u.createdAt.toISOString(),
  };
}
