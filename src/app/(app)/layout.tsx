import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen w-full flex-col md:flex-row">
      <Nav email={user.email ?? null} />
      <main className="flex min-w-0 flex-1 flex-col px-4 py-4 pb-28 md:px-8 md:py-8 md:pb-10 lg:px-10">
        {children}
      </main>
    </div>
  );
}
