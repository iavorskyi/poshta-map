import { prisma } from "@/lib/prisma";
import { PostmenClient } from "./PostmenClient";
import { requireAdmin } from "@/lib/auth";

export default async function PostmenPage() {
  const me = await requireAdmin();
  const postmen = await prisma.postman.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      phone: true,
      username: true,
      isAdmin: true,
      passwordHash: true,
      _count: { select: { rounds: true } },
    },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Поштарі</h1>
      <p className="text-fg-muted text-sm">Хто йде в обхід.</p>
      <PostmenClient
        selfId={me.id}
        postmen={postmen.map((p) => ({
          id: p.id,
          name: p.name,
          phone: p.phone,
          username: p.username,
          isAdmin: p.isAdmin,
          hasPassword: !!p.passwordHash,
          roundsCount: p._count.rounds,
        }))}
      />
    </div>
  );
}
