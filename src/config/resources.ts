/**
 * Default learning links. Shown until an admin adds resources in the dashboard
 * (the same links are also loaded into the database by supabase/seed.sql).
 */
export type ResourceLink = {
  title: { en: string; es?: string };
  description: { en: string; es?: string };
  url: string;
  subject: string;
  grade_band: string;
};

export const defaultResources: ResourceLink[] = [
  { subject: "reading", grade_band: "K–12", url: "https://detroitpubliclibrary.org", title: { en: "Detroit Public Library", es: "Biblioteca Pública de Detroit" }, description: { en: "Free books, e-books, homework help, and kids' programs. Get a free library card.", es: "Libros, libros electrónicos, ayuda con la tarea y programas para niños gratis. Saque su tarjeta gratis." } },
  { subject: "math", grade_band: "K–12", url: "https://www.khanacademy.org", title: { en: "Khan Academy", es: "Khan Academy" }, description: { en: "Free videos and practice for math, science, and more. Also in Spanish.", es: "Videos y práctica gratis de matemáticas, ciencias y más. También en español." } },
  { subject: "reading", grade_band: "K–3", url: "https://www.starfall.com", title: { en: "Starfall", es: "Starfall" }, description: { en: "Fun phonics and early reading games for young kids.", es: "Juegos divertidos de fonética y lectura para niños pequeños." } },
  { subject: "reading", grade_band: "K–8", url: "https://www.storylineonline.net", title: { en: "Storyline Online", es: "Storyline Online" }, description: { en: "Famous actors read picture books out loud.", es: "Actores famosos leen libros ilustrados en voz alta (en inglés)." } },
  { subject: "math", grade_band: "K–8", url: "https://www.mathplayground.com", title: { en: "Math Playground", es: "Math Playground" }, description: { en: "Math games and puzzles for grades 1–6.", es: "Juegos y rompecabezas de matemáticas para grados 1–6." } },
  { subject: "math", grade_band: "6–12", url: "https://www.desmos.com/calculator", title: { en: "Desmos Calculator", es: "Calculadora Desmos" }, description: { en: "A free graphing calculator that works on phones.", es: "Una calculadora gráfica gratis que funciona en teléfonos." } },
  { subject: "science", grade_band: "3–12", url: "https://www.nasa.gov/learning-resources/", title: { en: "NASA Learning Resources", es: "Recursos de NASA" }, description: { en: "Space and science activities from NASA.", es: "Actividades de ciencia y del espacio de la NASA." } },
  { subject: "science", grade_band: "K–8", url: "https://kids.nationalgeographic.com", title: { en: "National Geographic Kids", es: "National Geographic Kids" }, description: { en: "Animals, science, and the world, made for kids.", es: "Animales, ciencia y el mundo, para niños." } },
  { subject: "testprep", grade_band: "9–12", url: "https://satsuitequestionbank.collegeboard.org", title: { en: "SAT Question Bank", es: "Banco de preguntas del SAT" }, description: { en: "Free official SAT and PSAT practice questions.", es: "Preguntas de práctica oficiales y gratis del SAT y PSAT." } },
  { subject: "writing", grade_band: "6–12", url: "https://owl.purdue.edu", title: { en: "Purdue OWL", es: "Purdue OWL" }, description: { en: "Clear help with grammar, essays, and citing sources.", es: "Ayuda clara con gramática, ensayos y citas (en inglés)." } },
  { subject: "homework", grade_band: "K–12", url: "https://www.michigan.gov/mde", title: { en: "Michigan Department of Education", es: "Departamento de Educación de Michigan" }, description: { en: "Information about Michigan schools and tests like M-STEP.", es: "Información sobre las escuelas de Michigan y exámenes como M-STEP." } }
];
