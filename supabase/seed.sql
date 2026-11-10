-- =====================================================================
-- SEED DATA: starter site content + 3 sample quizzes for the shared library.
-- Run once after the migrations (Supabase SQL Editor, or `supabase db reset`).
-- Safe to run again: it skips rows that already exist.
-- =====================================================================

-- ---------- FAQ (English + Spanish) ----------
insert into public.faqs (id, question, answer, sort_order, show_on_home) values
('00000000-0000-4000-8000-0000000000f1', '{"en":"How much does it cost?","es":"¿Cuánto cuesta?"}', '{"en":"Nothing. Tutoring is free. We will never ask for a credit card.","es":"Nada. La tutoría es gratis. Nunca le pediremos una tarjeta de crédito."}', 1, true),
('00000000-0000-4000-8000-0000000000f2', '{"en":"Who can come?","es":"¿Quién puede venir?"}', '{"en":"Any student in grades K–12. You do not need to live in a certain neighborhood.","es":"Cualquier estudiante de los grados K–12. No necesita vivir en un vecindario específico."}', 2, true),
('00000000-0000-4000-8000-0000000000f3', '{"en":"What should my child bring?","es":"¿Qué debe traer mi hijo?"}', '{"en":"Their homework, a pencil, and any school papers they are stuck on. For online sessions, a phone, tablet, or computer with a camera is best.","es":"Su tarea, un lápiz y cualquier papel de la escuela que le cueste. Para sesiones en línea, lo mejor es un teléfono, tableta o computadora con cámara."}', 3, false),
('00000000-0000-4000-8000-0000000000f4', '{"en":"How do online sessions work?","es":"¿Cómo funcionan las sesiones en línea?"}', '{"en":"After you book, the tutor adds a video link (Google Meet or Zoom) to your booking. Open your dashboard a few minutes early and tap the link. A parent should be home and nearby.","es":"Después de reservar, el tutor agrega un enlace de video (Google Meet o Zoom) a su reserva. Abra su panel unos minutos antes y toque el enlace. Un adulto debe estar en casa y cerca."}', 4, true),
('00000000-0000-4000-8000-0000000000f5', '{"en":"What if my child is really struggling?","es":"¿Y si a mi hijo le cuesta mucho?"}', '{"en":"That is okay. That is why we are here. Ask for a free first meeting. The tutor will see where your child is and make a plan.","es":"Está bien. Para eso estamos. Pida una primera reunión gratis. El tutor verá dónde está su hijo y hará un plan."}', 5, true),
('00000000-0000-4000-8000-0000000000f6', '{"en":"How do I cancel?","es":"¿Cómo cancelo?"}', '{"en":"Open your dashboard and tap Cancel on the session. Please cancel at least 12 hours before.","es":"Abra su panel y toque Cancelar en la sesión. Por favor cancele al menos 12 horas antes."}', 6, false),
('00000000-0000-4000-8000-0000000000f7', '{"en":"How do you keep kids safe?","es":"¿Cómo cuidan a los niños?"}', '{"en":"Parents can see everything. Tutors cannot send private messages to kids. In-person sessions are in public places.","es":"Los padres pueden verlo todo. Los tutores no pueden mandar mensajes privados a los niños. Las sesiones en persona son en lugares públicos."}', 7, false)
on conflict (id) do nothing;

-- ---------- Testimonials: clearly marked placeholders. Replace with REAL quotes (with permission). ----------
insert into public.testimonials (id, quote, attribution, is_placeholder, sort_order) values
('00000000-0000-4000-8000-0000000000a1', '{"en":"[PLACEHOLDER] A short quote from a real parent, used with their permission.","es":"[PENDIENTE] Una cita corta de un padre o madre real, con su permiso."}', '[PLACEHOLDER] Parent of a 3rd grader', true, 1),
('00000000-0000-4000-8000-0000000000a2', '{"en":"[PLACEHOLDER] A short quote from a real student, used with a parent''s permission.","es":"[PENDIENTE] Una cita corta de un estudiante real, con permiso de sus padres."}', '[PLACEHOLDER] 7th grade student', true, 2)
on conflict (id) do nothing;

-- ---------- Resources ----------
insert into public.resources (title, description, url, subject, grade_band, sort_order)
select * from (values
  ('{"en":"Detroit Public Library","es":"Biblioteca Pública de Detroit"}'::jsonb, '{"en":"Free books, e-books, homework help, and kids'' programs. Get a free library card.","es":"Libros, libros electrónicos, ayuda con la tarea y programas para niños gratis."}'::jsonb, 'https://detroitpubliclibrary.org', 'reading', 'K–12', 1),
  ('{"en":"Khan Academy","es":"Khan Academy"}', '{"en":"Free videos and practice for math, science, and more. Also in Spanish.","es":"Videos y práctica gratis de matemáticas, ciencias y más. También en español."}', 'https://www.khanacademy.org', 'math', 'K–12', 2),
  ('{"en":"Starfall","es":"Starfall"}', '{"en":"Fun phonics and early reading games for young kids.","es":"Juegos divertidos de fonética y lectura para niños pequeños."}', 'https://www.starfall.com', 'reading', 'K–3', 3),
  ('{"en":"Math Playground","es":"Math Playground"}', '{"en":"Math games and puzzles for grades 1–6.","es":"Juegos y rompecabezas de matemáticas para grados 1–6."}', 'https://www.mathplayground.com', 'math', 'K–8', 4),
  ('{"en":"Desmos Calculator","es":"Calculadora Desmos"}', '{"en":"A free graphing calculator that works on phones.","es":"Una calculadora gráfica gratis que funciona en teléfonos."}', 'https://www.desmos.com/calculator', 'math', '6–12', 5),
  ('{"en":"NASA Learning Resources","es":"Recursos de NASA"}', '{"en":"Space and science activities from NASA.","es":"Actividades de ciencia y del espacio de la NASA."}', 'https://www.nasa.gov/learning-resources/', 'science', '3–12', 6),
  ('{"en":"Purdue OWL","es":"Purdue OWL"}', '{"en":"Clear help with grammar, essays, and citing sources.","es":"Ayuda clara con gramática, ensayos y citas (en inglés)."}', 'https://owl.purdue.edu', 'writing', '6–12', 7),
  ('{"en":"SAT Question Bank","es":"Banco de preguntas del SAT"}', '{"en":"Free official SAT and PSAT practice questions.","es":"Preguntas de práctica oficiales y gratis del SAT y PSAT."}', 'https://satsuitequestionbank.collegeboard.org', 'testprep', '9–12', 8)
) as v(title, description, url, subject, grade_band, sort_order)
where not exists (select 1 from public.resources);

-- =====================================================================
-- SAMPLE QUIZZES (shared library: tutor_id is null).
-- Tutors open "Quiz library" in their dashboard and tap "Make a copy" to use one.
-- =====================================================================
insert into public.quizzes (id, tutor_id, title, description, subject, grade_band) values
('11111111-0000-4000-8000-000000000001', null, 'Adding and Subtracting Fun', 'Practice adding, subtracting, and even numbers.', 'math', '1–3'),
('11111111-0000-4000-8000-000000000002', null, 'Reading: Belle Isle', 'Read a short passage about a Detroit park and answer questions.', 'reading', '6–8'),
('11111111-0000-4000-8000-000000000003', null, 'Pre-Algebra Warm-Up', 'Equations, fractions, negative numbers, and exponents.', 'math', '6–8')
on conflict (id) do nothing;

-- Helper to add a question + its answer key in one line (dropped at the end).
create or replace function pg_temp.q(p_id text, p_quiz text, p_pos int, p_type text, p_prompt text, p_choices jsonb, p_answer jsonb, p_hint text, p_expl text)
returns void language plpgsql as $$
begin
  insert into public.quiz_questions (id, quiz_id, position, type, prompt, choices, hint)
  values (p_id::uuid, p_quiz::uuid, p_pos, p_type, p_prompt, p_choices, p_hint) on conflict (id) do nothing;
  insert into public.quiz_question_keys (question_id, answer, explanation)
  values (p_id::uuid, p_answer, p_expl) on conflict (question_id) do nothing;
end $$;

-- Quiz 1: Elementary math
select pg_temp.q('22222222-0001-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001', 1, 'multiple_choice',
  'What is 7 + 5?', '[{"id":"a","text":"11"},{"id":"b","text":"12"},{"id":"c","text":"13"}]', '{"correct":"b"}',
  'Start at 7 and count up 5 more.', '7 + 5 = 12. You can think 7 + 3 = 10, then 2 more makes 12.');
select pg_temp.q('22222222-0001-4000-8000-000000000002', '11111111-0000-4000-8000-000000000001', 2, 'true_false',
  '10 − 4 = 6', '[]', '{"correct":true}', 'Hold up 10 fingers and put 4 down.', 'Ten take away four is six. True!');
select pg_temp.q('22222222-0001-4000-8000-000000000003', '11111111-0000-4000-8000-000000000001', 3, 'numeric',
  'Maria has 3 bags. Each bag has 4 apples. How many apples does she have in all?', '[]', '{"value":12,"tolerance":0}',
  'Add 4 three times: 4 + 4 + 4.', '3 groups of 4 is 12 apples.');
select pg_temp.q('22222222-0001-4000-8000-000000000004', '11111111-0000-4000-8000-000000000001', 4, 'multiple_select',
  'Which numbers are even? Pick all that are right.', '[{"id":"a","text":"3"},{"id":"b","text":"4"},{"id":"c","text":"7"},{"id":"d","text":"8"}]',
  '{"correct":["b","d"]}', 'Even numbers can be split into 2 equal groups.', '4 and 8 are even. 3 and 7 are odd.');
select pg_temp.q('22222222-0001-4000-8000-000000000005', '11111111-0000-4000-8000-000000000001', 5, 'fill_blank',
  '5 + ___ = 9', '[]', '{"blanks":[["4","four"]]}', 'What number do you add to 5 to get 9?', '9 − 5 = 4, so 5 + 4 = 9.');
select pg_temp.q('22222222-0001-4000-8000-000000000006', '11111111-0000-4000-8000-000000000001', 6, 'matching',
  'Match each problem to its answer.', '{"left":[{"id":"l1","text":"2 + 2"},{"id":"l2","text":"3 + 3"},{"id":"l3","text":"5 + 5"}],"right":[{"id":"r3","text":"10"},{"id":"r1","text":"4"},{"id":"r2","text":"6"}]}',
  '{"pairs":{"l1":"r1","l2":"r2","l3":"r3"}}', 'Doubles! Add each number to itself.', '2 + 2 = 4, 3 + 3 = 6, 5 + 5 = 10.');

-- Quiz 2: Middle school reading comprehension
select pg_temp.q('22222222-0002-4000-8000-000000000001', '11111111-0000-4000-8000-000000000002', 1, 'multiple_choice',
  E'Read the passage:\n\n"Belle Isle is an island park in the Detroit River. It has a conservatory full of plants, an aquarium, and a giant fountain. Families visit to picnic, fish, and watch boats. In 2014, it became a Michigan state park, and the state began fixing many of its old buildings."\n\nWhat is the main idea of the passage?',
  '[{"id":"a","text":"Belle Isle is a park with many things to see and do."},{"id":"b","text":"Fishing is the best hobby."},{"id":"c","text":"The Detroit River is very long."},{"id":"d","text":"Old buildings are hard to fix."}]',
  '{"correct":"a"}', 'The main idea is what MOST of the passage is about.', 'Most sentences describe what Belle Isle has and what people do there.');
select pg_temp.q('22222222-0002-4000-8000-000000000002', '11111111-0000-4000-8000-000000000002', 2, 'true_false',
  'According to the passage, Belle Isle is in Lake Erie.', '[]', '{"correct":false}', 'Look at the first sentence.', 'The passage says Belle Isle is in the Detroit River.');
select pg_temp.q('22222222-0002-4000-8000-000000000003', '11111111-0000-4000-8000-000000000002', 3, 'short_answer',
  'In what year did Belle Isle become a state park?', '[]', '{"accepted":["2014","in 2014"]}', 'Find the sentence with a number in it.', 'The passage says "In 2014, it became a Michigan state park."');
select pg_temp.q('22222222-0002-4000-8000-000000000004', '11111111-0000-4000-8000-000000000002', 4, 'multiple_select',
  'Which things does the passage say are on Belle Isle? Pick all that are right.',
  '[{"id":"a","text":"A conservatory"},{"id":"b","text":"An airport"},{"id":"c","text":"An aquarium"},{"id":"d","text":"A giant fountain"}]',
  '{"correct":["a","c","d"]}', 'Check the second sentence carefully.', 'The passage names a conservatory, an aquarium, and a giant fountain. No airport.');
select pg_temp.q('22222222-0002-4000-8000-000000000005', '11111111-0000-4000-8000-000000000002', 5, 'fill_blank',
  'Belle Isle is an island park in the Detroit ___.', '[]', '{"blanks":[["river"]]}', 'It is a body of water.', 'Belle Isle sits in the Detroit River, between Detroit and Canada.');
select pg_temp.q('22222222-0002-4000-8000-000000000006', '11111111-0000-4000-8000-000000000002', 6, 'multiple_choice',
  'In the passage, a "conservatory" is most likely…',
  '[{"id":"a","text":"a music school"},{"id":"b","text":"a glass building where plants grow"},{"id":"c","text":"a kind of boat"}]',
  '{"correct":"b"}', 'The passage says it is "full of plants."', 'Context clue: "full of plants" tells us it is a building for growing plants.');
select pg_temp.q('22222222-0002-4000-8000-000000000007', '11111111-0000-4000-8000-000000000002', 7, 'matching',
  'Match each word from the passage to its meaning.',
  '{"left":[{"id":"l1","text":"picnic"},{"id":"l2","text":"aquarium"},{"id":"l3","text":"island"}],"right":[{"id":"r2","text":"a place to see fish and water animals"},{"id":"r3","text":"land with water all around it"},{"id":"r1","text":"a meal eaten outside"}]}',
  '{"pairs":{"l1":"r1","l2":"r2","l3":"r3"}}', 'Think about where you have heard each word before.', 'Picnic = meal outside; aquarium = place for fish; island = land surrounded by water.');

-- Quiz 3: Pre-algebra (uses $...$ math)
select pg_temp.q('22222222-0003-4000-8000-000000000001', '11111111-0000-4000-8000-000000000003', 1, 'numeric',
  'Solve for $x$:  $x + 7 = 15$', '[]', '{"value":8,"tolerance":0}', 'Subtract 7 from both sides.', '$x = 15 - 7 = 8$');
select pg_temp.q('22222222-0003-4000-8000-000000000002', '11111111-0000-4000-8000-000000000003', 2, 'multiple_choice',
  'Which expression is equal to $3(x + 2)$?', '[{"id":"a","text":"$3x + 2$"},{"id":"b","text":"$3x + 6$"},{"id":"c","text":"$x + 6$"}]',
  '{"correct":"b"}', 'Multiply the 3 by BOTH things inside the parentheses.', 'Distributive property: $3 \cdot x + 3 \cdot 2 = 3x + 6$');
select pg_temp.q('22222222-0003-4000-8000-000000000003', '11111111-0000-4000-8000-000000000003', 3, 'true_false',
  '$(-4) \times (-3) = -12$', '[]', '{"correct":false}', 'What happens when you multiply two negative numbers?', 'A negative times a negative is positive: $(-4)(-3) = 12$');
select pg_temp.q('22222222-0003-4000-8000-000000000004', '11111111-0000-4000-8000-000000000003', 4, 'numeric',
  'Write $\frac{3}{4}$ as a decimal.', '[]', '{"value":0.75,"tolerance":0.001}', 'Divide 3 by 4.', '$3 \div 4 = 0.75$');
select pg_temp.q('22222222-0003-4000-8000-000000000005', '11111111-0000-4000-8000-000000000003', 5, 'multiple_select',
  'Which of these are equal to $\frac{1}{2}$? Pick all that are right.',
  '[{"id":"a","text":"$\\frac{2}{4}$"},{"id":"b","text":"$0.5$"},{"id":"c","text":"50%"},{"id":"d","text":"$\\frac{1}{3}$"}]',
  '{"correct":["a","b","c"]}', 'Try turning each one into a decimal.', '$\frac{2}{4} = 0.5 = 50\%$. But $\frac{1}{3} \approx 0.33$.');
select pg_temp.q('22222222-0003-4000-8000-000000000006', '11111111-0000-4000-8000-000000000003', 6, 'fill_blank',
  'If $2x = 10$, then $x =$ ___', '[]', '{"blanks":[["5","five"]]}', 'Divide both sides by 2.', '$x = 10 \div 2 = 5$');
select pg_temp.q('22222222-0003-4000-8000-000000000007', '11111111-0000-4000-8000-000000000003', 7, 'matching',
  'In $5x + 3$, match each word to the right part.',
  '{"left":[{"id":"l1","text":"variable"},{"id":"l2","text":"coefficient"},{"id":"l3","text":"constant"}],"right":[{"id":"r3","text":"$3$"},{"id":"r1","text":"$x$"},{"id":"r2","text":"$5$"}]}',
  '{"pairs":{"l1":"r1","l2":"r2","l3":"r3"}}', 'The coefficient is the number stuck to the letter.', 'Variable $x$, coefficient $5$, constant $3$.');
select pg_temp.q('22222222-0003-4000-8000-000000000008', '11111111-0000-4000-8000-000000000003', 8, 'short_answer',
  'What is the value of $2^3$?', '[]', '{"accepted":["8","eight"]}', '$2^3$ means $2 \times 2 \times 2$.', '$2 \times 2 \times 2 = 8$');
