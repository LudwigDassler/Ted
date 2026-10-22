export interface DiscoThemeConfig {
  id: string;
  title: string;
  subtitle: string;
  /** Путь к файлу в папке public/ репозитория (/art1.jpg .. /art4.jpg) */
  repoPath: string;
  /** Вшитый Base64/WebP код картины (генерируется кнопкой «Скачать artworks.ts») */
  embeddedDataUrl: string;
  /** Палитра [основной, вторичный, свет, тень] для оформления задника окна и дождя */
  palette: [string, string, string, string];
}

export const DISCO_THEMES: DiscoThemeConfig[] = [
  {
    id: "slot_1",
    title: "I. Текила Сансет",
    subtitle: "Зелёный пиджак, галстук и фиолетовый шторм",
    repoPath: "/art1.jpg",
    embeddedDataUrl: "",
    palette: ["#9333ea", "#4d6b38", "#e05a3c", "#161124"],
  },
  {
    id: "slot_2",
    title: "II. Ухмылка Кусто",
    subtitle: "Прищур, белый блик на лбу и палец-пистолет",
    repoPath: "/art2.jpg",
    embeddedDataUrl: "",
    palette: ["#d97706", "#64748b", "#b85d43", "#1c1917"],
  },
  {
    id: "slot_3",
    title: "III. Психоз (B' B'')",
    subtitle: "Протуберанец фуксии и кадмия из виска",
    repoPath: "/art3.jpg",
    embeddedDataUrl: "",
    palette: ["#ff007f", "#ff5400", "#00f5d4", "#120924"],
  },
  {
    id: "slot_4",
    title: "IV. Пьета Долорес",
    subtitle: "Светящиеся золотые лёгкие и берлинская лазурь",
    repoPath: "/art4.jpg",
    embeddedDataUrl: "",
    palette: ["#f59e0b", "#1e3a8a", "#dc2626", "#0b111e"],
  },
];
