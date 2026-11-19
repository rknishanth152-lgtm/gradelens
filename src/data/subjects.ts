/** Subject definitions for B.Sc. Computer Technology, batch 2025–28. */

export interface SubjectOption {
  code: string;
  name: string;
}

export interface Sem3Subject {
  id: string;
  code: string;
  name: string;
  short: string;
  /** CIA max (0 if none). */
  ciaMax: number;
  /** ESE max (0 when CIA-only). */
  eseMax: number;
  totalMax: number;
  credits: number;
  /** Counted towards SGPA/CGPA. */
  counted: boolean;
  /** Part of the class "Sem 3 percentage" (out of 550). */
  inPercentage: boolean;
  options?: SubjectOption[];
}

export const ELECTIVE_OPTIONS: SubjectOption[] = [
  { code: '25CTU01', name: 'Designing Interactive Systems for Extended Reality' },
  { code: '25CTU02', name: 'Swarm Intelligence and Distributed AI' },
];

export const MDC_OPTIONS: SubjectOption[] = [
  { code: '25MDC33', name: 'Bharathiya Management Principles and Practices' },
  { code: '25MDC27', name: 'Food Science and Nutrition in Ayurveda' },
  { code: '25MDCxx', name: 'Other' },
];

export const SEM3_SUBJECTS: Sem3Subject[] = [
  { id: 'rdbms', code: '25CSS06A', name: 'Relational Database Management Systems', short: 'RDBMS', ciaMax: 20, eseMax: 30, totalMax: 50, credits: 3, counted: true, inPercentage: true },
  { id: 'sql', code: '25CSS06B', name: 'Practical: SQL and PL/SQL', short: 'SQL practical', ciaMax: 20, eseMax: 30, totalMax: 50, credits: 1, counted: true, inPercentage: true },
  { id: 'se', code: '25CSS07A', name: 'Software Engineering', short: 'Software Engg.', ciaMax: 20, eseMax: 30, totalMax: 50, credits: 3, counted: true, inPercentage: true },
  { id: 'testing', code: '25CSS07B', name: 'Practical: Software Testing', short: 'Testing practical', ciaMax: 20, eseMax: 30, totalMax: 50, credits: 1, counted: true, inPercentage: true },
  { id: 'iot', code: '25CSS08', name: 'Internet of Things', short: 'IoT', ciaMax: 20, eseMax: 30, totalMax: 50, credits: 2, counted: true, inPercentage: true },
  { id: 'elective', code: '25CTU01', name: 'Elective', short: 'Elective', ciaMax: 40, eseMax: 60, totalMax: 100, credits: 3, counted: true, inPercentage: true, options: ELECTIVE_OPTIONS },
  { id: 'or', code: '25MCU22', name: 'Operations Research for Computer Studies', short: 'Operations Research', ciaMax: 40, eseMax: 60, totalMax: 100, credits: 4, counted: true, inPercentage: true },
  { id: 'mdc', code: '25MDC33', name: 'Multidisciplinary course', short: 'MDC', ciaMax: 100, eseMax: 0, totalMax: 100, credits: 2, counted: true, inPercentage: false, options: MDC_OPTIONS },
  { id: 'capstone', code: '25VAC03', name: 'Capstone Project', short: 'Capstone', ciaMax: 100, eseMax: 0, totalMax: 100, credits: 2, counted: false, inPercentage: true },
];

export const NPTEL_SUBJECT: Sem3Subject = {
  id: 'nptel', code: 'NPTEL', name: 'NPTEL course', short: 'NPTEL', ciaMax: 0, eseMax: 0, totalMax: 100, credits: 2, counted: true, inPercentage: true,
};

export const SEM3_PERCENT_MAX = 550;
export const SEM3_PERCENT_MAX_NPTEL = 650;

/** Previous-semester subjects (only counted ones need entry). */
export interface PrevSubject {
  id: string;
  code: string;
  name: string;
  totalMax: number;
  credits: number;
  counted: boolean;
}

export const SEM1_SUBJECTS: PrevSubject[] = [
  { id: 'lang1', code: '25AEC—', name: 'Language I (Tamil / Hindi / French)', totalMax: 100, credits: 3, counted: false },
  { id: 'eng1', code: '25AEC21', name: 'English I', totalMax: 100, credits: 3, counted: false },
  { id: 'cpp', code: '25CSS01A', name: 'Object Oriented Programming using C++', totalMax: 50, credits: 3, counted: true },
  { id: 'cppLab', code: '25CSS01B', name: 'Practical: OOP using C++', totalMax: 50, credits: 1, counted: true },
  { id: 'dsa', code: '25CSS02', name: 'Data Structures & Algorithms', totalMax: 100, credits: 4, counted: true },
  { id: 'maths1', code: '25MCU06', name: 'Mathematical Foundation for Computer Science', totalMax: 100, credits: 4, counted: true },
  { id: 'evs', code: '25VAC01', name: 'Environmental Studies', totalMax: 100, credits: 2, counted: false },
];

export const SEM2_SUBJECTS: PrevSubject[] = [
  { id: 'lang2', code: '25AEC—', name: 'Language II (Tamil / Hindi / French)', totalMax: 100, credits: 3, counted: false },
  { id: 'eng2', code: '25AEC23', name: 'English II', totalMax: 100, credits: 3, counted: false },
  { id: 'java', code: '25CSS03', name: 'Programming with Java', totalMax: 100, credits: 4, counted: true },
  { id: 'javaLab', code: '25CSS04', name: 'Practical: Java', totalMax: 100, credits: 1, counted: true },
  { id: 'os', code: '25CSS05', name: 'Operating Systems', totalMax: 100, credits: 4, counted: true },
  { id: 'maths2', code: '25MCU14', name: 'Numerical Methods & Statistics', totalMax: 100, credits: 4, counted: true },
  { id: 'mdc2', code: '25MDCxx', name: 'MDC (Mutual Funds, Export Marketing, …)', totalMax: 100, credits: 2, counted: true },
  { id: 'iks', code: '25VAC02', name: 'Indian Knowledge System', totalMax: 100, credits: 2, counted: false },
];

export const PREV_SUBJECTS: Record<1 | 2, PrevSubject[]> = { 1: SEM1_SUBJECTS, 2: SEM2_SUBJECTS };
export const DEFAULT_PREV_CREDITS: Record<1 | 2, number> = { 1: 12, 2: 15 };
export const DEFAULT_FUTURE_CREDITS = 19;
