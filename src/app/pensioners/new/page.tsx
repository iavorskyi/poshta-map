import Link from "next/link";
import { PensionerForm } from "../PensionerForm";

export default function NewPensionerPage() {
  return (
    <div className="space-y-4">
      <div>
        <Link href="/pensioners" className="text-sm text-blue-600 hover:underline">
          ← До списку
        </Link>
        <h1 className="text-2xl font-semibold mt-1">Новий пенсіонер</h1>
      </div>
      <PensionerForm />
    </div>
  );
}
