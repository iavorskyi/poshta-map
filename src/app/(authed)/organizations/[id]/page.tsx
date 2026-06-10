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
      relationsA: {
        include: {
          b: {
            select: {
              id: true,
              name: true,
              address: true,
              picksUpMail: true,
              contacts: {
                orderBy: { id: "asc" },
                select: { id: true, name: true, phone: true },
              },
            },
          },
        },
      },
      relationsB: {
        include: {
          a: {
            select: {
              id: true,
              name: true,
              address: true,
              picksUpMail: true,
              contacts: {
                orderBy: { id: "asc" },
                select: { id: true, name: true, phone: true },
              },
            },
          },
        },
      },
    },
  });
  if (!org) notFound();

  // Збираємо звʼязки в єдиний список «інша сторона». Інваріант aId<bId
  // означає, що `relationsA` — інша сторона має більший id, `relationsB` —
  // менший. Для UI це байдуже, нам потрібен лише id зв'язку та інша орг.
  const relations = [
    ...org.relationsA.map((r) => ({
      relationId: r.id,
      note: r.note,
      other: r.b,
    })),
    ...org.relationsB.map((r) => ({
      relationId: r.id,
      note: r.note,
      other: r.a,
    })),
  ].sort((x, y) => x.other.name.localeCompare(y.other.name, "uk"));

  const linkedIds = new Set(relations.map((r) => r.other.id));
  linkedIds.add(org.id);

  // Кандидати на звʼязок — усі інші орги, без вже звʼязаних і без самої себе.
  const candidates = await prisma.organization.findMany({
    where: { id: { notIn: Array.from(linkedIds) } },
    select: {
      id: true,
      name: true,
      address: true,
      description: true,
      contacts: {
        orderBy: { id: "asc" },
        select: { name: true, phone: true, note: true },
      },
    },
    orderBy: { name: "asc" },
  });

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
      relations={relations.map((r) => ({
        relationId: r.relationId,
        note: r.note,
        other: {
          id: r.other.id,
          name: r.other.name,
          address: r.other.address,
          picksUpMail: r.other.picksUpMail,
          contacts: r.other.contacts.map((c) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
          })),
        },
      }))}
      candidates={candidates.map((c) => ({
        id: c.id,
        name: c.name,
        address: c.address,
        description: c.description,
        contacts: c.contacts.map((cc) => ({
          name: cc.name,
          phone: cc.phone,
          note: cc.note,
        })),
      }))}
      canManage={canManageOrganizations(me)}
    />
  );
}
