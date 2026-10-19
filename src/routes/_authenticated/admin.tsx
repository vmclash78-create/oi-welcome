import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Tables } from "@/integrations/supabase/types";

type Course = Tables<"courses">;

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administração | Plataforma de cursos" },
      { name: "description", content: "Gerencie cursos, usuários e vendas." },
      { property: "og:title", content: "Administração | Plataforma de cursos" },
      { property: "og:description", content: "Painel de administração da plataforma." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function AdminPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const isAdmin = useQuery({
    queryKey: ["is-admin", user.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      return !!data;
    },
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true, search: { redirect: undefined } });
  }

  if (isAdmin.isLoading) return <div className="p-8 text-muted-foreground">Carregando...</div>;
  if (!isAdmin.data)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-xl font-semibold">Acesso restrito</h1>
        <p className="text-muted-foreground">Sua conta ({user.email}) não é administradora.</p>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/">Início</Link></Button>
          <Button onClick={signOut}>Sair</Button>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <h1 className="text-lg font-bold">Administração</h1>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm"><Link to="/">Ver site</Link></Button>
          <Button variant="outline" size="sm" onClick={signOut}>Sair</Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4">
        <Tabs defaultValue="courses">
          <TabsList>
            <TabsTrigger value="courses">Cursos</TabsTrigger>
            <TabsTrigger value="users">Usuários</TabsTrigger>
            <TabsTrigger value="sales">Vendas</TabsTrigger>
          </TabsList>
          <TabsContent value="courses"><CoursesTab /></TabsContent>
          <TabsContent value="users"><UsersTab myId={user.id} /></TabsContent>
          <TabsContent value="sales"><SalesTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function CoursesTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Course> | null>(null);
  const [lessonsFor, setLessonsFor] = useState<Course | null>(null);
  const courses = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const save = useMutation({
    mutationFn: async (c: Partial<Course>) => {
      const payload = {
        title: c.title ?? "",
        description: c.description ?? "",
        category: c.category ?? "Tecnologia",
        instructor: c.instructor ?? "",
        price: Number(c.price ?? 0),
        image_url: c.image_url || null,
        published: !!c.published,
      };
      const { error } = c.id
        ? await supabase.from("courses").update(payload).eq("id", c.id)
        : await supabase.from("courses").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Curso salvo"); setEditing(null); qc.invalidateQueries({ queryKey: ["admin-courses"] }); },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("courses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Curso excluído"); qc.invalidateQueries({ queryKey: ["admin-courses"] }); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 pt-4">
      <Button onClick={() => setEditing({ published: false, price: 0 })}>Novo curso</Button>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {courses.data?.map((c) => (
          <div key={c.id} className="space-y-2 rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold">{c.title}</h3>
              <Badge variant={c.published ? "default" : "secondary"}>{c.published ? "Publicado" : "Rascunho"}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{c.category} · {c.instructor || "—"} · {brl(Number(c.price))}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(c)}>Editar</Button>
              <Button size="sm" variant="outline" onClick={() => setLessonsFor(c)}>Aulas</Button>
              <Button size="sm" variant="destructive" onClick={() => confirm(`Excluir "${c.title}"?`) && remove.mutate(c.id)}>Excluir</Button>
            </div>
          </div>
        ))}
        {courses.data?.length === 0 && <p className="text-muted-foreground">Nenhum curso ainda.</p>}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar curso" : "Novo curso"}</DialogTitle></DialogHeader>
          {editing && (
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(editing); }}>
              <Field label="Título"><Input required value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></Field>
              <Field label="Descrição"><Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Categoria"><Input value={editing.category ?? ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} /></Field>
                <Field label="Preço (R$)"><Input type="number" step="0.01" min="0" value={editing.price ?? 0} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} /></Field>
              </div>
              <Field label="Instrutor"><Input value={editing.instructor ?? ""} onChange={(e) => setEditing({ ...editing, instructor: e.target.value })} /></Field>
              <Field label="Imagem (link)"><Input value={editing.image_url ?? ""} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} /></Field>
              <div className="flex items-center gap-2">
                <Switch checked={!!editing.published} onCheckedChange={(v) => setEditing({ ...editing, published: v })} />
                <Label>Publicado</Label>
              </div>
              <Button type="submit" disabled={save.isPending} className="w-full">Salvar</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!lessonsFor} onOpenChange={(o) => !o && setLessonsFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Aulas — {lessonsFor?.title}</DialogTitle></DialogHeader>
          {lessonsFor && <LessonsEditor courseId={lessonsFor.id} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label>{label}</Label>{children}</div>;
}

function LessonsEditor({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const key = ["lessons", courseId];
  const lessons = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from("lessons").select("*").eq("course_id", courseId).order("position");
      if (error) throw error;
      return data;
    },
  });
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("lessons").insert({ course_id: courseId, title, video_url: url || null, position: lessons.data?.length ?? 0 });
      if (error) throw error;
    },
    onSuccess: () => { setTitle(""); setUrl(""); qc.invalidateQueries({ queryKey: key }); },
    onError: (e) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lessons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
  return (
    <div className="space-y-3">
      <ol className="space-y-2">
        {lessons.data?.map((l, i) => (
          <li key={l.id} className="flex items-center justify-between gap-2 rounded border p-2 text-sm">
            <span>{i + 1}. {l.title}</span>
            <Button size="sm" variant="ghost" onClick={() => del.mutate(l.id)}>Remover</Button>
          </li>
        ))}
        {lessons.data?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma aula.</p>}
      </ol>
      <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
        <Input placeholder="Título da aula" required value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input placeholder="Link do vídeo (opcional)" value={url} onChange={(e) => setUrl(e.target.value)} />
        <Button type="submit" size="sm" disabled={add.isPending}>Adicionar aula</Button>
      </form>
    </div>
  );
}

function UsersTab({ myId }: { myId: string }) {
  const qc = useQueryClient();
  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [p, r] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (p.error) throw p.error;
      const admins = new Set((r.data ?? []).filter((x) => x.role === "admin").map((x) => x.user_id));
      return (p.data ?? []).map((u) => ({ ...u, isAdmin: admins.has(u.id) }));
    },
  });
  const toggle = useMutation({
    mutationFn: async ({ id, makeAdmin }: { id: string; makeAdmin: boolean }) => {
      const { error } = makeAdmin
        ? await supabase.from("user_roles").insert({ user_id: id, role: "admin" })
        : await supabase.from("user_roles").delete().eq("user_id", id).eq("role", "admin");
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Permissão atualizada"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="overflow-x-auto pt-4">
      <Table>
        <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>E-mail</TableHead><TableHead>Cadastro</TableHead><TableHead>Admin</TableHead></TableRow></TableHeader>
        <TableBody>
          {users.data?.map((u) => (
            <TableRow key={u.id}>
              <TableCell>{u.full_name || "—"}</TableCell>
              <TableCell>{u.email}</TableCell>
              <TableCell>{new Date(u.created_at).toLocaleDateString("pt-BR")}</TableCell>
              <TableCell>
                <Switch checked={u.isAdmin} disabled={u.id === myId} onCheckedChange={(v) => toggle.mutate({ id: u.id, makeAdmin: v })} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SalesTab() {
  const sales = useQuery({
    queryKey: ["admin-sales"],
    queryFn: async () => {
      const [e, p] = await Promise.all([
        supabase.from("enrollments").select("id, user_id, amount, created_at, courses(title)").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, email"),
      ]);
      if (e.error) throw e.error;
      const emails = new Map((p.data ?? []).map((x) => [x.id, x.email]));
      return (e.data ?? []).map((s) => ({ ...s, email: emails.get(s.user_id) ?? "—" }));
    },
  });
  const total = sales.data?.reduce((a, s) => a + Number(s.amount), 0) ?? 0;
  return (
    <div className="space-y-4 pt-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border bg-card p-4"><p className="text-sm text-muted-foreground">Matrículas</p><p className="text-2xl font-bold">{sales.data?.length ?? 0}</p></div>
        <div className="rounded-lg border bg-card p-4"><p className="text-sm text-muted-foreground">Faturamento</p><p className="text-2xl font-bold">{brl(total)}</p></div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Aluno</TableHead><TableHead>Curso</TableHead><TableHead>Valor</TableHead></TableRow></TableHeader>
          <TableBody>
            {sales.data?.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{new Date(s.created_at).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell>{s.email}</TableCell>
                <TableCell>{s.courses?.title ?? "—"}</TableCell>
                <TableCell>{brl(Number(s.amount))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {sales.data?.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nenhuma venda ainda.</p>}
      </div>
    </div>
  );
}
