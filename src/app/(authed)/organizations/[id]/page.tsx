import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageOrganizations } from "@/lib/permissions";
import { OrganizationDetailClient } from "./OrganizationDetailClient";

export const dynamic = "force-dynamic";

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireUser();
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) notFound();

  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: { id: "asc" } },
    },
  });
  if (!org) notFound();

  return (
    <OrganizationDetailClient
      org={{
        id: org.id,
        name: org.name,
        address: org.address,
        description: org.description,
        picksUpMail: org.picksUpMail,
        contacts: org.contacts.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          note: c.note,
        })),
      }}
      canManage={canManageOrganizations(me)}
    />
  );
}
