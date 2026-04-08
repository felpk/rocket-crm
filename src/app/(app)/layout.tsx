import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen">
      <Sidebar userRole={session.role} userName={session.name} />
      <main className="md:ml-64 min-h-screen p-6 pt-16 md:pt-6">
        {children}
      </main>
    </div>
  );
}
