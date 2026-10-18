import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  GraduationCap,
  Menu,
  PlayCircle,
  Search,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";

export const Route = createFileRoute("/")({ component: Index });

type Course = {
  id: string | number;
  title: string;
  teacher: string;
  category: string;
  level: string;
  lessons: number;
  duration: string;
  price: number;
  rating: string;
  color: string;
  accent: string;
  mark: string;
  description: string;
  thumbnailUrl?: string;
  imageUrl?: string;
};

type InstructorStatus = "none" | "pending" | "approved" | "rejected";
type QueryError = { message: string };
type InstructorRow = { status: string };
type InstructorQueryResult = { data: InstructorRow | null; error: QueryError | null };
type InstructorQuery = {
  select: (columns: string) => InstructorQuery;
  eq: (column: string, value: string) => InstructorQuery;
  maybeSingle: () => Promise<InstructorQueryResult>;
  insert: (values: { user_id: string; bio: string; status: "pending" }) => InstructorQuery;
  single: () => Promise<InstructorQueryResult>;
};
type CourseDraftRow = { id: string; title: string; status: string };
type CourseDraftInsert = {
  insert: (values: {
    instructor_id: string;
    title: string;
    slug: string;
    subtitle: string;
    description: string;
    category: string;
    level: string;
    price_cents: number;
    currency: "BRL";
    status: "draft";
  }) => {
    select: (columns: string) => {
      single: () => Promise<{ data: CourseDraftRow | null; error: QueryError | null }>;
    };
  };
};
const courses: Course[] = [
  {
    id: 1,
    title: "Design de interfaces do zero",
    imageUrl: "/images/course-design.svg",
    teacher: "Marina Costa",
    category: "Design",
    level: "Iniciante",
    lessons: 42,
    duration: "8h 20min",
    price: 149.9,
    rating: "4,9",
    color: "#f4dfd2",
    accent: "#a95635",
    mark: "UI",
    description:
      "Fundamentos de design, hierarquia visual, cores e composição para criar interfaces consistentes.",
  },
  {
    id: 2,
    title: "Marketing digital na prática",
    imageUrl: "/images/course-marketing.svg",
    teacher: "Rafael Mendes",
    category: "Marketing",
    level: "Intermediário",
    lessons: 35,
    duration: "6h 45min",
    price: 119.9,
    rating: "4,8",
    color: "#dce8d5",
    accent: "#436b50",
    mark: "MKT",
    description:
      "Planeje campanhas, entenda seu público e transforme estratégia em ações mensuráveis.",
  },
  {
    id: 3,
    title: "Programação web com React",
    imageUrl: "/images/course-code.svg",
    teacher: "Lucas Almeida",
    category: "Tecnologia",
    level: "Intermediário",
    lessons: 58,
    duration: "12h 10min",
    price: 199.9,
    rating: "5,0",
    color: "#d9e3f5",
    accent: "#315c9d",
    mark: "</>",
    description: "Construa aplicações modernas com componentes, estado, rotas e boas práticas.",
  },
  {
    id: 4,
    title: "Fotografia para negócios",
    imageUrl: "/images/course-photo.svg",
    teacher: "Camila Rocha",
    category: "Criatividade",
    level: "Iniciante",
    lessons: 24,
    duration: "4h 30min",
    price: 89.9,
    rating: "4,7",
    color: "#f0e2b9",
    accent: "#806523",
    mark: "FOTO",
    description: "Produza fotos melhores para produtos, portfólio e redes sociais.",
  },
  {
    id: 5,
    title: "Finanças para empreendedores",
    imageUrl: "/images/course-finance.svg",
    teacher: "André Ribeiro",
    category: "Negócios",
    level: "Iniciante",
    lessons: 29,
    duration: "5h 15min",
    price: 129.9,
    rating: "4,9",
    color: "#d5e8e3",
    accent: "#2d6a5d",
    mark: "R$",
    description: "Organize o caixa, precifique seus serviços e tome decisões com segurança.",
  },
  {
    id: 6,
    title: "Conteúdo que vende",
    imageUrl: "/images/course-content.svg",
    teacher: "Bianca Alves",
    category: "Marketing",
    level: "Iniciante",
    lessons: 21,
    duration: "3h 50min",
    price: 79.9,
    rating: "4,8",
    color: "#e8d9ed",
    accent: "#79548a",
    mark: "SOC",
    description: "Crie conteúdo estratégico para atrair pessoas e apresentar suas ofertas.",
  },
];
const categories = ["Todos", "Design", "Tecnologia", "Marketing", "Negócios", "Criatividade"];
const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Index() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todos");
  const [selected, setSelected] = useState<Course | null>(null);
  const [notice, setNotice] = useState("");
  const [view, setView] = useState<"catalog" | "student" | "creator">("catalog");
  const [library, setLibrary] = useState<Array<Course["id"]>>([3]);
  const [progress, setProgress] = useState<Record<string, number>>({ "3": 35 });
  const [menuOpen, setMenuOpen] = useState(false);
  const [liveCourses, setLiveCourses] = useState<Course[] | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string | null } | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [instructorStatus, setInstructorStatus] = useState<InstructorStatus>("none");
  const [applicationBusy, setApplicationBusy] = useState(false);
  const [courseFormOpen, setCourseFormOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftSubtitle, setDraftSubtitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftCategory, setDraftCategory] = useState("Design");
  const [draftLevel, setDraftLevel] = useState("Iniciante");
  const [draftPrice, setDraftPrice] = useState("0");
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftMessage, setDraftMessage] = useState("");
  const [createdDrafts, setCreatedDrafts] = useState<CourseDraftRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!cancelled) {
          const user = data.session?.user;
          setCurrentUser(user ? { id: user.id, email: user.email ?? null } : null);
        }
      })
      .catch((error: unknown) => console.warn("Não foi possível recuperar a sessão.", error));
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      setCurrentUser(user ? { id: user.id, email: user.email ?? null } : null);
    });
    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const activeUserId = currentUser?.id;
  useEffect(() => {
    if (!activeUserId) {
      setInstructorStatus("none");
      setCreatedDrafts([]);
      return;
    }
    let active = true;
    const client = supabase as unknown as {
      from: (table: "instructor_profiles") => InstructorQuery;
    };
    void client
      .from("instructor_profiles")
      .select("status")
      .eq("user_id", activeUserId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) throw error;
        if (active) {
          const status = data?.status;
          setInstructorStatus(status === "approved" || status === "pending" || status === "rejected" ? status : "none");
        }
      })
      .catch((error: unknown) => {
        console.warn("Não foi possível carregar o status de produtor.", error);
        if (active) setInstructorStatus("none");
      });
    return () => {
      active = false;
    };
  }, [activeUserId]);

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthMessage("");
    try {
      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: authEmail.trim(),
          password: authPassword,
          options: { data: { display_name: authName.trim() } },
        });
        if (error) throw error;
        if (data.session) {
          setAuthOpen(false);
          setNotice("Conta criada com sucesso.");
        } else {
          setAuthMessage(
            "Conta iniciada. Confira seu e-mail para confirmar o cadastro antes de entrar.",
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail.trim(),
          password: authPassword,
        });
        if (error) throw error;
        setAuthOpen(false);
        setNotice("Login realizado com sucesso.");
      }
      setAuthPassword("");
    } catch (error) {
      setAuthMessage(
        error instanceof Error ? error.message : "Não foi possível autenticar. Tente novamente.",
      );
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      showNotice("Não foi possível sair da conta. Tente novamente.");
      return;
    }
    setCurrentUser(null);
    setNotice("Você saiu da sua conta.");
  };

  const openAuth = (mode: "signin" | "signup") => {
    setAuthMode(mode);
    setAuthMessage("");
    setAuthPassword("");
    setAuthOpen(true);
  };

  const applyAsInstructor = async () => {
    if (!currentUser) {
      openAuth("signup");
      return;
    }
    setApplicationBusy(true);
    try {
      const client = supabase as unknown as {
        from: (table: "instructor_profiles") => InstructorQuery;
      };
      const { data, error } = await client
        .from("instructor_profiles")
        .insert({ user_id: currentUser.id, bio: "", status: "pending" })
        .select("status")
        .single();
      if (error) throw error;
      setInstructorStatus(data?.status === "approved" ? "approved" : "pending");
      setNotice("Solicitação enviada. A publicação de cursos será liberada após a aprovação do perfil de produtor.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível enviar a solicitação. Verifique se a migração do banco já foi aplicada.");
    } finally {
      setApplicationBusy(false);
    }
  };

  const handleCreateCourse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUser || instructorStatus !== "approved") {
      setDraftMessage("É necessário ter uma conta e aprovação de produtor para criar cursos.");
      return;
    }
    const title = draftTitle.trim();
    const slug = title.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const numericPrice = Number(draftPrice);
    if (!title || !slug || !Number.isFinite(numericPrice) || numericPrice < 0) {
      setDraftMessage("Confira o título e o preço informado.");
      return;
    }
    setDraftBusy(true);
    setDraftMessage("");
    try {
      const client = supabase as unknown as {
        from: (table: "courses") => CourseDraftInsert;
      };
      const { data, error } = await client.from("courses").insert({
        instructor_id: currentUser.id,
        title,
        slug,
        subtitle: draftSubtitle.trim(),
        description: draftDescription.trim(),
        category: draftCategory,
        level: draftLevel,
        price_cents: Math.round(numericPrice * 100),
        currency: "BRL",
        status: "draft",
      }).select("id,title,status").single();
      if (error) throw error;
      if (data) setCreatedDrafts((previous) => [data, ...previous]);
      setCourseFormOpen(false);
      setDraftTitle("");
      setDraftSubtitle("");
      setDraftDescription("");
      setDraftPrice("0");
      setNotice("Rascunho salvo no banco de dados. Adicione módulos e aulas antes de publicar o curso.");
    } catch (error) {
      setDraftMessage(error instanceof Error ? error.message : "Não foi possível salvar o curso. Confira a migração do banco e as permissões do perfil.");
    } finally {
      setDraftBusy(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const loadPublishedCourses = async () => {
      try {
        // The project keeps generated Supabase table types empty until they are regenerated.
        // Keep the query boundary isolated here so the rest of the page remains typed.
        type PublishedCourseRow = {
          id: string;
          title: string;
          subtitle: string | null;
          description: string | null;
          category: string | null;
          level: string | null;
          price_cents: number;
          thumbnail_url: string | null;
        };
        type CourseQueryResult = {
          data: PublishedCourseRow[] | null;
          error: { message: string } | null;
        };
        type CourseQuery = {
          select: (columns: string) => CourseQuery;
          eq: (column: string, value: string) => CourseQuery;
          order: (column: string, options: { ascending: boolean }) => Promise<CourseQueryResult>;
        };
        const client = supabase as unknown as {
          from: (table: "courses") => CourseQuery;
        };
        const { data, error } = await client
          .from("courses")
          .select("id,title,subtitle,description,category,level,price_cents,thumbnail_url")
          .eq("status", "published")
          .order("published_at", { ascending: false });
        if (error) throw error;
        const palette: Record<string, { color: string; accent: string }> = {
          Design: { color: "#f4dfd2", accent: "#a95635" },
          Marketing: { color: "#dce8d5", accent: "#436b50" },
          Tecnologia: { color: "#d9e3f5", accent: "#315c9d" },
          Criatividade: { color: "#f0e2b9", accent: "#806523" },
          Negócios: { color: "#d5e8e3", accent: "#2d6a5d" },
        };
        const mapped: Course[] = (data ?? []).map(
          (row: {
            id: string;
            title: string;
            subtitle: string | null;
            description: string | null;
            category: string | null;
            level: string | null;
            price_cents: number;
            thumbnail_url: string | null;
          }) => {
            const colors = palette[row.category || ""] ?? { color: "#e8d9ed", accent: "#79548a" };
            return {
              id: row.id,
              title: row.title,
              teacher: "Instrutor",
              category: row.category || "Geral",
              level: row.level || "Iniciante",
              lessons: 0,
              duration: "Aulas em breve",
              price: row.price_cents / 100,
              rating: "Novo",
              color: colors.color,
              accent: colors.accent,
              mark: row.title
                .split(/\s+/)
                .slice(0, 2)
                .map((word: string) => word[0] || "")
                .join("")
                .toUpperCase(),
              description:
                row.description ||
                row.subtitle ||
                "Detalhes deste curso serão publicados em breve.",
              thumbnailUrl: row.thumbnail_url || undefined,
            };
          },
        );
        if (!cancelled) setLiveCourses(mapped);
      } catch (error) {
        console.warn(
          "Não foi possível carregar cursos publicados; exibindo catálogo demonstrativo.",
          error,
        );
        if (!cancelled) setLiveCourses(null);
      }
    };
    void loadPublishedCourses();
    return () => {
      cancelled = true;
    };
  }, []);

  const catalogCourses = liveCourses ?? courses;
  const filtered = useMemo(
    () =>
      catalogCourses.filter(
        (c) =>
          (category === "Todos" || c.category === category) &&
          [c.title, c.teacher, c.category].some((v) =>
            v.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")),
          ),
      ),
    [catalogCourses, search, category],
  );
  const showNotice = (message: string) => {
    setNotice(message);
    setSelected(null);
  };
  const buy = (course: Course) => {
    setLibrary((prev) => (prev.includes(course.id) ? prev : [...prev, course.id]));
    setNotice(
      "Demonstração: o checkout e a confirmação de pagamento ainda serão integrados. Nenhuma cobrança foi realizada.",
    );
  };
  const courseCard = (course: Course, student = false) => (
    <article className="course-card" key={course.id}>
      <button
        className="course-art"
        style={{ background: course.color, color: course.accent }}
        onClick={() => {
          setSelected(course);
          setNotice("");
        }}
        aria-label={"Detalhes: " + course.title}
      >
        {course.thumbnailUrl && (
          <img className="course-thumb" src={course.thumbnailUrl} alt="" loading="lazy" />
        )}
        <span className="art-tag">{course.category}</span>
        <strong>{course.mark}</strong>
        <i />
        <span className="art-arrow">
          <ArrowRight size={18} />
        </span>
      </button>
      <div className="course-content">
        <div className="course-meta">
          <span>{student ? "Seu progresso" : course.level}</span>
          <span>
            <Star size={13} fill="currentColor" />{" "}
            {student ? (progress[course.id] || 0) + "%" : course.rating}
          </span>
        </div>
        {student && (
          <div className="progress">
            <span style={{ width: (progress[course.id] || 0) + "%" }} />
          </div>
        )}
        <button
          className="course-title"
          onClick={() => {
            setSelected(course);
            setNotice("");
          }}
        >
          {course.title}
        </button>
        <p className="teacher">por {course.teacher}</p>
        <div className="course-details">
          <span>
            <PlayCircle size={14} />{" "}
            {course.lessons ? `${course.lessons} aulas` : "Conteúdo em breve"}
          </span>
          <span>
            <Clock3 size={14} /> {course.duration}
          </span>
        </div>
        <div className="course-footer">
          <strong>{student ? "" : money(course.price)}</strong>
          <button
            onClick={() =>
              student
                ? setProgress((prev) => ({
                    ...prev,
                    [course.id]: Math.min(100, (prev[course.id] || 0) + 10),
                  }))
                : (setSelected(course), setNotice(""))
            }
          >
            {student
              ? (progress[course.id] || 0) >= 100
                ? "Concluído"
                : "Continuar aula"
              : "Ver curso"}{" "}
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </article>
  );

  return (
    <div className="site-shell">
      <header className="header">
        <a href="#home" className="logo" onClick={() => setView("catalog")}>
          <span className="logo-symbol">
            <GraduationCap size={22} />
          </span>
          <span>
            Cursos<span className="logo-dot">.</span>
          </span>
        </a>
        <button
          className="mobile-menu"
          aria-label="Abrir menu"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
        <nav className={menuOpen ? "navigation nav-open" : "navigation"}>
          <button
            className={view === "catalog" ? "nav-item nav-active" : "nav-item"}
            onClick={() => {
              setView("catalog");
              setMenuOpen(false);
            }}
          >
            Explorar cursos
          </button>
          <button
            className={view === "student" ? "nav-item nav-active" : "nav-item"}
            onClick={() => {
              if (currentUser) setView("student");
              else openAuth("signin");
              setMenuOpen(false);
            }}
          >
            Área do aluno
          </button>
          <button
            className={view === "creator" ? "nav-item nav-active" : "nav-item"}
            onClick={() => {
              if (currentUser) setView("creator");
              else openAuth("signup");
              setMenuOpen(false);
            }}
          >
            Para produtores
          </button>
          <button
            className="nav-item mobile-auth-link"
            onClick={() => {
              if (currentUser) void handleSignOut();
              else openAuth("signin");
              setMenuOpen(false);
            }}
          >
            {currentUser ? "Sair da conta" : "Entrar"}
          </button>
        </nav>
        <div className="header-actions">
          <button
            className="login"
            onClick={() => (currentUser ? void handleSignOut() : openAuth("signin"))}
          >
            {currentUser ? "Sair da conta" : "Entrar"}
          </button>
          <button
            className="button button-dark"
            onClick={() => (currentUser ? setView("creator") : openAuth("signup"))}
          >
            Quero ensinar <ArrowRight size={16} />
          </button>
        </div>
      </header>
      {notice && (
        <div className="notice" role="status">
          {notice}
          <button aria-label="Fechar aviso" onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {view === "catalog" && (
        <main id="home">
          <section className="hero">
            <div className="hero-text">
              <span className="eyebrow">
                <span className="eyebrow-dot" /> APRENDA NO SEU RITMO
              </span>
              <h1>
                Conhecimento que
                <br />
                <em>abre caminhos.</em>
              </h1>
              <p className="hero-description">
                Cursos práticos, pessoas que entendem do assunto e habilidades para levar suas
                ideias mais longe.
              </p>
              <div className="hero-buttons">
                <button
                  className="button button-dark button-large"
                  onClick={() =>
                    document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  Encontrar meu próximo curso <ArrowRight size={17} />
                </button>
                <button className="button button-text" onClick={() => currentUser ? setView("creator") : openAuth("signup")}>
                  Quero ensinar ↗
                </button>
              </div>
              <div className="social-proof">
                <div className="avatars">
                  <span>MC</span>
                  <span>RA</span>
                  <span>LA</span>
                  <span>+</span>
                </div>
                <div>
                  <div className="proof-rating">
                    <Star size={13} fill="currentColor" /> <strong>4,9/5</strong>
                  </div>
                  <small>Avaliação média dos cursos</small>
                </div>
              </div>
            </div>
            <div className="hero-visual hero-visual-photo">
              <div className="hero-ring ring-one" />
              <div className="hero-ring ring-two" />
              <div className="floating-note note-one">
                <span className="note-icon">
                  <Check size={17} />
                </span>
                <span>
                  <strong>Aprendizado real</strong>
                  <small>Conhecimento aplicável</small>
                </span>
              </div>
              <div className="feature-card">
                <div className="feature-cover">\n                  <img className="hero-art-image" src="/images/learning-hero.svg" alt="" fetchPriority="high" />
                  <span className="feature-label">EM DESTAQUE</span>
                  <div className="feature-shape shape-a" />
                  <div className="feature-shape shape-b" />
                  <div className="feature-words">
                    DESIGN
                    <br />
                    COM INTENÇÃO
                  </div>
                </div>
                <div className="feature-info">
                  <div>
                    <small>CURSO EM DESTAQUE</small>
                    <h3>Design de interfaces</h3>
                    <p>Marina Costa · 42 aulas</p>
                  </div>
                  <button
                    aria-label="Abrir curso em destaque"
                    onClick={() => setSelected(courses[0])}
                  >
                    <PlayCircle size={23} />
                  </button>
                </div>
              </div>
              <div className="floating-note note-two">
                <span className="note-icon note-icon-purple">
                  <BookOpen size={17} />
                </span>
                <span>
                  <strong>Aprenda fazendo</strong>
                  <small>Do primeiro passo ao projeto</small>
                </span>
              </div>
            </div>
          </section>
          <section className="benefits">
            <span>APRENDA COM QUEM FAZ</span>
            <div>
              <ShieldCheck size={18} /> Conteúdo prático
            </div>
            <div>
              <Clock3 size={18} /> No seu tempo
            </div>
            <div>
              <PlayCircle size={18} /> Aulas sob demanda
            </div>
            <div>
              <GraduationCap size={18} /> Evolução contínua
            </div>
          </section>
          <section className="catalog section-wrap" id="catalog">
            <div className="section-heading">
              <div>
                <span className="section-kicker">SUA PRÓXIMA DESCOBERTA</span>
                <h2>Explore os cursos</h2>
                <p>Escolha uma habilidade. Dê o próximo passo.</p>
              </div>
              <label className="search-box">
                <Search size={18} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar curso ou instrutor"
                />
                <kbd>/</kbd>
              </label>
            </div>
            <div className="category-list">
              {categories.map((c) => (
                <button
                  key={c}
                  className={category === c ? "category-chip chip-active" : "category-chip"}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="course-grid">{filtered.map((c) => courseCard(c))}</div>
            {filtered.length === 0 && (
              <div className="empty">
                <Search size={28} />
                <h3>
                  {liveCourses !== null && liveCourses.length === 0
                    ? "Ainda não há cursos publicados"
                    : "Nenhum curso encontrado"}
                </h3>
                <p>
                  {liveCourses !== null && liveCourses.length === 0
                    ? "Os cursos aparecerão aqui quando um produtor publicar o primeiro conteúdo."
                    : "Tente outro termo ou limpe os filtros."}
                </p>
                {(search || category !== "Todos") && (
                  <button
                    className="button button-dark"
                    onClick={() => {
                      setSearch("");
                      setCategory("Todos");
                    }}
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            )}
            <div className="catalog-bottom">
              <span>{filtered.length} cursos demonstrativos</span>
              <button
                className="button button-text"
                onClick={() => {
                  setSearch("");
                  setCategory("Todos");
                }}
              >
                Limpar filtros <ArrowRight size={15} />
              </button>
            </div>
          </section>
          <section className="creator-promo">
            <div className="promo-visual">
              <div className="dashboard-art">
                <div className="dash-top">
                  <i />
                  <i />
                  <i />
                </div>
                <div className="dash-line" />
                <div className="dash-line short" />
                <div className="dash-bars">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              </div>
              <div className="promo-cap">
                <GraduationCap size={27} />
              </div>
            </div>
            <div className="promo-copy">
              <span className="section-kicker">SEU CONHECIMENTO TEM VALOR</span>
              <h2>
                Você ensina.
                <br />O mundo aprende.
              </h2>
              <p>
                Transforme o que você sabe em um curso online. Organize suas aulas e acompanhe seus
                alunos em um só lugar.
              </p>
              <button className="button button-dark" onClick={() => setView("creator")}>
                Conhecer área do produtor <ArrowRight size={16} />
              </button>
            </div>
          </section>
          <section className="faq">
            <div>
              <span className="section-kicker">TIRE SUAS DÚVIDAS</span>
              <h2>
                Comece com
                <br />
                tranquilidade.
              </h2>
              <p>Informações claras para escolher seu próximo passo.</p>
            </div>
            <div className="faq-items">
              <details>
                <summary>
                  Como funcionam os cursos online?
                  <ChevronDown size={18} />
                </summary>
                <p>
                  Após a compra confirmada, o aluno acessará as aulas pela área do aluno e poderá
                  acompanhar seu progresso.
                </p>
              </details>
              <details>
                <summary>
                  Posso estudar no meu próprio ritmo?
                  <ChevronDown size={18} />
                </summary>
                <p>
                  Sim. A proposta é permitir que você organize seus estudos conforme sua rotina.
                </p>
              </details>
              <details>
                <summary>
                  Como publico meu curso?
                  <ChevronDown size={18} />
                </summary>
                <p>
                  Na área do produtor você poderá estruturar o curso e organizar as aulas. A
                  publicação real exige configuração do backend.
                </p>
              </details>
              <details>
                <summary>
                  O pagamento já está funcionando?
                  <ChevronDown size={18} />
                </summary>
                <p>
                  Não. O checkout ainda será integrado a um provedor de pagamento e validado antes
                  de receber cobranças reais.
                </p>
              </details>
            </div>
          </section>
        </main>
      )}
      {view === "student" && (
        <main className="workspace">
          <span className="section-kicker">SUA JORNADA DE APRENDIZADO</span>
          <h1>Continue de onde parou.</h1>
          <p className="workspace-lead">Retome suas aulas e acompanhe sua evolução.</p>
          <div className="summary-grid">
            <div>
              <BookOpen />
              <strong>{library.length}</strong>
              <span>Cursos na biblioteca</span>
            </div>
            <div>
              <Check />
              <strong>{Object.values(progress).filter((n) => n >= 100).length}</strong>
              <span>Cursos concluídos</span>
            </div>
            <div>
              <Clock3 />
              <strong>{Object.values(progress).reduce((a, b) => a + b, 0)}%</strong>
              <span>Progresso acumulado</span>
            </div>
          </div>
          <h2 className="workspace-subtitle">Minha biblioteca</h2>
          <div className="course-grid">
            {courses.filter((c) => library.includes(c.id)).map((c) => courseCard(c, true))}
          </div>
          {library.length === 0 && (
            <div className="empty">
              <BookOpen />
              <h3>Sua biblioteca está vazia</h3>
              <button className="button button-dark" onClick={() => setView("catalog")}>
                Explorar cursos
              </button>
            </div>
          )}
          <button className="button button-text back" onClick={() => setView("catalog")}>
            ← Voltar ao catálogo
          </button>
        </main>
      )}
      {view === "creator" && (
        <main className="workspace">
          <span className="section-kicker">ÁREA DO PRODUTOR</span>
          <h1>Seu conhecimento pode ir mais longe.</h1>
          <p className="workspace-lead">
            Organize cursos, acompanhe alunos e entenda seus resultados.
          </p>
          <div className="creator-welcome">
            <div>
              <span className="eyebrow">
                {instructorStatus === "approved" ? "PRODUTOR APROVADO" : instructorStatus === "pending" ? "SOLICITAÇÃO EM ANÁLISE" : "ÁREA DO PRODUTOR"}
              </span>
              <h2>Ensine o que você sabe.</h2>
              <p>Estruture seu conteúdo e prepare seu primeiro curso para seus alunos.</p>
              {instructorStatus === "none" && (
                <button className="button button-dark" onClick={() => void applyAsInstructor()} disabled={applicationBusy}>
                  {applicationBusy ? "Enviando..." : "Solicitar acesso de produtor"} <ArrowRight size={16} />
                </button>
              )}
              {instructorStatus === "pending" && (
                <p className="producer-status producer-pending">Sua solicitação foi recebida. A criação de cursos será liberada após a aprovação.</p>
              )}
              {instructorStatus === "rejected" && (
                <p className="producer-status producer-rejected">A solicitação não foi aprovada. Entre em contato com o suporte para revisar o cadastro.</p>
              )}
              {instructorStatus === "approved" && (
                <button className="button button-dark" onClick={() => { setDraftMessage(""); setCourseFormOpen(true); }}>
                  Criar novo curso <ArrowRight size={16} />
                </button>
              )}
            </div>
            <GraduationCap size={86} strokeWidth={1.1} />
          </div>
          <div className="summary-grid creator-stats">
            <div>
              <span>Vendas totais</span>
              <strong>R$ 0,00</strong>
              <small>Dados demonstrativos</small>
            </div>
            <div>
              <span>Alunos inscritos</span>
              <strong>0</strong>
              <small>Aguardando integração</small>
            </div>
            <div>
              <span>Cursos publicados</span>
              <strong>0</strong>
              <small>Pronto para configurar</small>
            </div>
          </div>
          <div className="setup-card">
            <ShieldCheck size={24} />
            <div>
              <h3>Antes de vender de verdade</h3>
              <p>
                O catálogo e o cadastro de cursos usam o Supabase. Para vender, ainda será necessário
                conectar o checkout a um provedor de pagamento e confirmar pedidos por webhook seguro.
              </p>
            </div>
          </div>
          <button className="button button-text back" onClick={() => setView("catalog")}>
            ← Voltar ao catálogo
          </button>
        </main>
      )}
      {courseFormOpen && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !draftBusy) setCourseFormOpen(false);
          }}
        >
          <section className="auth-modal course-form-modal" role="dialog" aria-modal="true" aria-labelledby="draft-course-title">
            <button className="modal-x" aria-label="Fechar" onClick={() => setCourseFormOpen(false)} disabled={draftBusy}>
              <X />
            </button>
            <span className="section-kicker">NOVO RASCUNHO</span>
            <h2 id="draft-course-title">Monte seu curso.</h2>
            <p>Salve as informações iniciais. O curso ficará como rascunho até você adicionar o conteúdo e publicá-lo.</p>
            <form className="auth-form" onSubmit={handleCreateCourse}>
              <label>
                Título do curso
                <input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} required minLength={3} maxLength={180} placeholder="Ex.: Fotografia para pequenos negócios" />
              </label>
              <label>
                Subtítulo
                <input value={draftSubtitle} onChange={(event) => setDraftSubtitle(event.target.value)} maxLength={240} placeholder="O que o aluno vai aprender?" />
              </label>
              <label>
                Descrição
                <textarea className="form-textarea" value={draftDescription} onChange={(event) => setDraftDescription(event.target.value)} maxLength={10000} rows={4} placeholder="Descreva o conteúdo e para quem ele é indicado." />
              </label>
              <div className="form-two-columns">
                <label>
                  Categoria
                  <select value={draftCategory} onChange={(event) => setDraftCategory(event.target.value)}>
                    <option>Design</option>
                    <option>Tecnologia</option>
                    <option>Marketing</option>
                    <option>Negócios</option>
                    <option>Criatividade</option>
                    <option>Geral</option>
                  </select>
                </label>
                <label>
                  Nível
                  <select value={draftLevel} onChange={(event) => setDraftLevel(event.target.value)}>
                    <option>Iniciante</option>
                    <option>Intermediário</option>
                    <option>Avançado</option>
                    <option>Todos os níveis</option>
                  </select>
                </label>
              </div>
              <label>
                Preço (R$)
                <input type="number" value={draftPrice} onChange={(event) => setDraftPrice(event.target.value)} min="0" max="100000" step="0.01" required />
              </label>
              {draftMessage && <p className="auth-message" role="status">{draftMessage}</p>}
              <button className="button button-dark auth-submit" type="submit" disabled={draftBusy}>
                {draftBusy ? "Salvando..." : "Salvar como rascunho"} <ArrowRight size={16} />
              </button>
            </form>
          </section>
        </div>
      )}
      {createdDrafts.length > 0 && view === "creator" && (
        <section className="workspace draft-list">
          <h2 className="workspace-subtitle">Rascunhos criados nesta sessão</h2>
          {createdDrafts.map((draft) => (
            <div className="draft-row" key={draft.id}>
              <BookOpen size={19} />
              <div><strong>{draft.title}</strong><small>Rascunho · ainda não visível no catálogo</small></div>
              <span>{draft.status}</span>
            </div>
          ))}
        </section>
      )}
      {authOpen && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !authBusy) setAuthOpen(false);
          }}
        >
          <section
            className="auth-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-title"
          >
            <button
              className="modal-x"
              aria-label="Fechar"
              onClick={() => setAuthOpen(false)}
              disabled={authBusy}
            >
              <X />
            </button>
            <span className="section-kicker">
              {authMode === "signup" ? "CRIE SUA CONTA" : "BEM-VINDO DE VOLTA"}
            </span>
            <h2 id="auth-title">
              {authMode === "signup" ? "Comece sua jornada." : "Entre na sua conta."}
            </h2>
            <p>
              {authMode === "signup"
                ? "Crie seu acesso para acompanhar cursos e preparar seu espaço de produtor."
                : "Acesse sua biblioteca e continue aprendendo."}
            </p>
            <form className="auth-form" onSubmit={handleAuthSubmit}>
              {authMode === "signup" && (
                <label>
                  Nome
                  <input
                    value={authName}
                    onChange={(event) => setAuthName(event.target.value)}
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={100}
                    placeholder="Como podemos chamar você?"
                  />
                </label>
              )}
              <label>
                E-mail
                <input
                  type="email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  autoComplete="email"
                  required
                  maxLength={254}
                  placeholder="voce@exemplo.com"
                />
              </label>
              <label>
                Senha
                <input
                  type="password"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                  required
                  minLength={6}
                  maxLength={128}
                  placeholder="Pelo menos 6 caracteres"
                />
              </label>
              {authMessage && (
                <p className="auth-message" role="status">
                  {authMessage}
                </p>
              )}
              <button className="button button-dark auth-submit" type="submit" disabled={authBusy}>
                {authBusy ? "Aguarde..." : authMode === "signup" ? "Criar conta" : "Entrar"}{" "}
                <ArrowRight size={16} />
              </button>
            </form>
            <p className="auth-switch">
              {authMode === "signup" ? "Já tem uma conta?" : "Ainda não tem conta?"}{" "}
              <button
                className="button button-text"
                onClick={() => openAuth(authMode === "signup" ? "signin" : "signup")}
                disabled={authBusy}
              >
                {authMode === "signup" ? "Entrar" : "Criar conta"}
              </button>
            </p>
          </section>
        </div>
      )}
      {selected && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <section
            className="course-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="course-modal-title"
          >
            <button className="modal-x" aria-label="Fechar" onClick={() => setSelected(null)}>
              <X />
            </button>
            <div
              className="modal-art"
              style={{ background: selected.color, color: selected.accent }}
            >
              {(selected.thumbnailUrl || selected.imageUrl) && (
                <img className="modal-thumb" src={selected.thumbnailUrl || selected.imageUrl} alt="" />
              )}
              <span>{selected.category}</span>
              <strong>{selected.mark}</strong>
            </div>
            <div className="modal-body">
              <div className="course-meta">
                <span>{selected.level}</span>
                <span>
                  <Star size={14} fill="currentColor" /> {selected.rating}
                </span>
              </div>
              <h2 id="course-modal-title">{selected.title}</h2>
              <p className="teacher">Criado por {selected.teacher}</p>
              <p>{selected.description}</p>
              <div className="modal-facts">
                <span>
                  <PlayCircle size={16} />{" "}
                  {selected.lessons ? `${selected.lessons} aulas` : "Conteúdo em breve"}
                </span>
                <span>
                  <Clock3 size={16} /> {selected.duration}
                </span>
                <span>
                  <ShieldCheck size={16} /> Acesso flexível
                </span>
              </div>
              <div className="modal-purchase">
                <div>
                  <small>Investimento único</small>
                  <strong>{money(selected.price)}</strong>
                </div>
                <button className="button button-dark" onClick={() => buy(selected)}>
                  {library.includes(selected.id) ? "Adicionar à biblioteca" : "Quero este curso"}{" "}
                  <ArrowRight size={16} />
                </button>
              </div>
              <p className="checkout-note">
                <ShieldCheck size={14} /> Checkout demonstrativo. Nenhuma cobrança será feita.
              </p>
              {notice && <p className="modal-notice">{notice}</p>}
            </div>
          </section>
        </div>
      )}
      <footer className="footer">
        <a href="#home" className="logo">
          <span className="logo-symbol">
            <GraduationCap size={20} />
          </span>
          <span>
            Cursos<span className="logo-dot">.</span>
          </span>
        </a>
        <span>Aprender é abrir possibilidades.</span>
        <span>© 2026 · Plataforma de cursos</span>
      </footer>
      <button
        className="help-button"
        aria-label="Central de ajuda"
        onClick={() =>
          showNotice(
            "Central de ajuda: os canais de suporte serão configurados antes do lançamento.",
          )
        }
      >
        <CircleHelp size={20} />
      </button>
    </div>
  );
}
