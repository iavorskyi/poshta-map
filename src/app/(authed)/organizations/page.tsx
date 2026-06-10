import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canManageOrganizations } from "@/lib/permissions";
import { searchOrganizations } from "@/lib/orgSearch";
import { OrganizationsClient } from "./OrganizationsClient";

export const dynamic = "force-dynamic";

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const me = await requireUser();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();

  // Тягнемо весь список з контактами і ранжуємо у памʼяті — записів небагато,
  // а SQL-fuzzy на трьох полях надто шумний без trigram-extension.
  const orgs = await prisma.organization.findMany({
    orderBy: { name: "asc" },
    include: {
      contacts: {
        orderBy: { id: "asc" },
        select: { id: true, name: true, phone: true, note: true },
      },
    },
  });

  const hits = searchOrganizations(orgs, q);
  const canManage = canManageOrganizations(me);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold">Організації</h1>
      </div>

      <OrganizationsClient
        orgs={hits.map((h) => ({
          id: h.org.id,
          name: h.org.name,
          address: h.org.address,
          description: h.org.description,
          picksUpMail: h.org.picksUpMail,
          storageLocation: h.org.storageLocation,
          contacts: h.org.contacts,
          matchedOn: h.matchedOn,
        }))}
        q={q}
        canManage={canManage}
      />

      {hits.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-fg-subtle text-sm">
          {q ? (
            <>
              За запитом «{q}» нічого не знайдено.{" "}
              <Link href="/organizations" className="link">
                Скинути
              </Link>
            </>
          ) : (
            "Організацій ще немає. Додайте першу зверху."
          )}
        </div>
      )}
    </div>
  );
}
