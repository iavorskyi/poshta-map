import { prisma } from "@/lib/prisma";
import { PostmenClient } from "./PostmenClient";

export default async function PostmenPage() {
  const postmen = await prisma.postman.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { rounds: true } } },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Поштарі</h1>
      <p className="text-slate-600 text-sm">Хто йде в обхід.</p>
      <PostmenClient postmen={postmen.map((p) => ({ id: p.id, name: p.name, roundsCount: p._count.rounds }))} />
    </div>
  );
}
