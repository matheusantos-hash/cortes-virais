import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { deleteJob } from "../actions";
import StatusBadge from "@/components/StatusBadge";
import { fmtDate, isFinal, jobTitle } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Job } from "@/lib/types";

interface Usuario {
  id: string;
  email: string | null;
  xandao: number;
  created_at: string;
}

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Barreira 1 (interface): só xandao = 1 entra. A barreira real é o RLS no banco.
  const { data: me } = await supabase.from("usuarios").select("xandao").eq("id", user.id).maybeSingle();
  if (me?.xandao !== 1) notFound();

  const [{ data: usersData }, { data: jobsData }] = await Promise.all([
    supabase.from("usuarios").select("id,email,xandao,created_at").order("created_at", { ascending: false }),
    supabase.from("jobs").select("*").order("created_at", { ascending: false }).limit(500),
  ]);
  const users = (usersData ?? []) as Usuario[];
  const jobs = (jobsData ?? []) as Job[];

  const emailOf = new Map(users.map((u) => [u.id, u.email ?? "—"]));
  const jobsByUser = new Map<string, number>();
  jobs.forEach((j) => jobsByUser.set(j.user_id, (jobsByUser.get(j.user_id) ?? 0) + 1));

  const done = jobs.filter((j) => j.status === "done").length;
  const failed = jobs.filter((j) => j.status === "failed").length;
  const running = jobs.filter((j) => !isFinal(j.status)).length;

  return (
    <div className="stack-lg">
      <h1>Painel administrativo</h1>

      <div className="stats">
        <div className="card stat"><strong>{users.length}</strong><span>usuários</span></div>
        <div className="card stat"><strong>{jobs.length}</strong><span>pedidos</span></div>
        <div className="card stat"><strong>{done}</strong><span>concluídos</span></div>
        <div className="card stat"><strong>{failed}</strong><span>com falha</span></div>
        <div className="card stat"><strong>{running}</strong><span>em andamento</span></div>
      </div>
      <p className="muted small">Números calculados sobre os últimos 500 pedidos.</p>

      <section className="stack">
        <h2>Usuários</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>E-mail</th><th>Cadastro</th><th>Pedidos</th><th>Perfil</th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.email ?? "—"}</td>
                  <td>{fmtDate(u.created_at)}</td>
                  <td>{jobsByUser.get(u.id) ?? 0}</td>
                  <td>{u.xandao === 1 ? "Admin" : "Usuário"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="stack">
        <h2>Pedidos recentes</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Data</th><th>Usuário</th><th>Origem</th><th>Status</th><th>Erro</th><th></th></tr>
            </thead>
            <tbody>
              {jobs.slice(0, 100).map((j) => (
                <tr key={j.id}>
                  <td>{fmtDate(j.created_at)}</td>
                  <td>{emailOf.get(j.user_id) ?? "—"}</td>
                  <td>
                    <Link className="link" href={`/jobs/${j.id}`}>
                      {jobTitle(j)}
                    </Link>
                  </td>
                  <td><StatusBadge status={j.status} /></td>
                  <td className="small">{j.error ?? ""}</td>
                  <td>
                    <form action={deleteJob}>
                      <input type="hidden" name="id" value={j.id} />
                      <button className="link danger">Excluir</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">
          Excluir apaga o pedido e os registros dos clipes. Os arquivos no Storage continuam lá e precisam ser removidos à parte.
        </p>
      </section>
    </div>
  );
}
