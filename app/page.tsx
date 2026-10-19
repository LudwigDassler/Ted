"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";

// ============================================================================
// 1. ТИПЫ ДАННЫХ S.M.A.R.T. И ДИАЛОГОВОЙ СИСТЕМЫ DISCO ELYSIUM
// ============================================================================

type HealthState = "GOOD" | "CAUTION" | "BAD";
type PersonaId = "harry" | "kim" | "radiocomputer";

interface SmartAttribute {
  id: string; // HEX ID, напр. "01", "05", "09", "C2"
  name: string;
  ruName: string;
  current: number;
  worst: number;
  threshold: number;
  rawDec: number;
  status: HealthState;
  unit?: string;
  voices: {
    skill: string;
    category: "INT" | "PSY" | "FYS" | "MOT";
    difficulty: string;
    text: string;
  }[];
}

interface DriveProfile {
  id: string;
  letter: string;
  name: string;
  model: string;
  capacityGB: number;
  firmware: string;
  serial: string;
  interfaceType: string;
  transferMode: string;
  standard: string;
  features: string;
  healthStatus: HealthState;
  healthPercent: number;
  temperature: number;
  totalReadsGB: number;
  totalWritesGB: number;
  powerOnCount: number;
  powerOnHours: number;
  rotationRate: string;
  introQuote: string;
  attributes: SmartAttribute[];
}

interface DialogueEntry {
  id: string;
  timestamp: string;
  skill: string;
  category: "INT" | "PSY" | "FYS" | "MOT" | "SYS";
  checkResult?: "SUCCESS" | "FAILURE" | "INFO";
  difficulty?: string;
  text: string;
  attrId?: string;
}

// ============================================================================
// 2. ПРЕДУСТАНОВЛЕННЫЕ НАКОПИТЕЛИ С ПОЛНОЙ БАЗОЙ ЗНАНИЙ S.M.A.R.T.
// ============================================================================

const INITIAL_DRIVES: DriveProfile[] = [
  {
    id: "nvme_c",
    letter: "C:",
    name: "РАДИОКОМПЬЮТЕР РГМ-41 (Системный)",
    model: "Samsung SSD 980 PRO 1TB (Revachol Precinct #41)",
    capacityGB: 1000.2,
    firmware: "5B2QGXA7",
    serial: "S69ENF0R841951K",
    interfaceType: "NVM Express",
    transferMode: "PCIe 4.0 x4 | PCIe 4.0 x4",
    standard: "NVM Express 1.4",
    features: "S.M.A.R.T., TRIM, VolatileWriteCache",
    healthStatus: "GOOD",
    healthPercent: 96,
    temperature: 41,
    totalReadsGB: 14820,
    totalWritesGB: 19450,
    powerOnCount: 1412,
    powerOnHours: 4890,
    rotationRate: "---- (SSD / Твердотельный)",
    introQuote:
      "Кремниевый кристалл тихо пульсирует на частоте четырёх линий PCIe 4.0. Память свежа, дорожки чисты, ни одного потерянного воспоминания.",
    attributes: [
      {
        id: "01",
        name: "Critical Warning",
        ruName: "Критические предупреждения контроллера",
        current: 100,
        worst: 100,
        threshold: 0,
        rawDec: 0,
        status: "GOOD",
        voices: [
          {
            skill: "ЭНЦИКЛОПЕДИЯ",
            category: "INT",
            difficulty: "Легко: Успех",
            text: "Регистр 01h в спецификации NVMe — это битовая маска аварийных флагов: нехватка резервных блоков, деградация надёжности, перегрев или переход в режим «только чтение». Сейчас все биты равны нулю.",
          },
          {
            skill: "ВНУТРЕННЯЯ ИМПЕРИЯ",
            category: "PSY",
            difficulty: "Средне: Успех",
            text: "Тишина в эфире. Никаких сирен, никаких криков из глубин кремния. Этот диск ещё не видел настоящего ужаса.",
          },
        ],
      },
      {
        id: "02",
        name: "Composite Temperature",
        ruName: "Составная температура датчиков",
        current: 100,
        worst: 82,
        threshold: 85,
        rawDec: 41,
        unit: "°C",
        status: "GOOD",
        voices: [
          {
            skill: "ИНТЕРФЕЙС",
            category: "MOT",
            difficulty: "Легко: Успех",
            text: "41 градус Цельсия — рабочая температура здорового контроллера под медным радиатором. Троттлинг начинается лишь после 70–78 °C.",
          },
          {
            skill: "ТРЕПЕТ",
            category: "FYS",
            difficulty: "Средне: Успех",
            text: "Тёплый воздух выдувается сквозь пыльную решётку системного блока, согревая холодный утренний воздух Мартинеза.",
          },
        ],
      },
      {
        id: "03",
        name: "Available Spare",
        ruName: "Доступный резерв запасных блоков",
        current: 100,
        worst: 100,
        threshold: 10,
        rawDec: 100,
        unit: "%",
        status: "GOOD",
        voices: [
          {
            skill: "ЛОГИКА",
            category: "INT",
            difficulty: "Легко: Успех",
            text: "Неразмеченный пул резервных ячеек (Over-Provisioning) нетронут — 100% при критическом пороге 10%. Алгоритм выравнивания износа работает безупречно.",
          },
        ],
      },
      {
        id: "05",
        name: "Percentage Used",
        ruName: "Степень выработки ресурса NAND",
        current: 96,
        worst: 96,
        threshold: 0,
        rawDec: 4,
        unit: "%",
        status: "GOOD",
        voices: [
          {
            skill: "ЭНЦИКЛОПЕДИЯ",
            category: "INT",
            difficulty: "Средне: Успех",
            text: "Израсходовано всего 4% гарантированного ресурса перезаписи (TBW). Оксидный слой в ячейках V-NAND почти не накопил паразитных электронов.",
          },
          {
            skill: "ВОЛЯ",
            category: "PSY",
            difficulty: "Легко: Успех",
            text: "Запас прочности 96%. Ты скорее сотрёшь собственные воспоминания, чем исчерпаешь этот накопитель.",
          },
        ],
      },
      {
        id: "06",
        name: "Data Units Read",
        ruName: "Прочитано единиц данных (по 512 КБ)",
        current: 100,
        worst: 100,
        threshold: 0,
        rawDec: 29640120,
        status: "GOOD",
        voices: [
          {
            skill: "МАТЕМАТИЧЕСКИЙ АНАЛИЗ",
            category: "INT",
            difficulty: "Легко: Успех",
            text: "Чтение не разрушает туннельный диэлектрик флеш-памяти. 14.8 терабайт прочитанных архивов прошли без единого пробоя.",
          },
        ],
      },
      {
        id: "07",
        name: "Data Units Written",
        ruName: "Записано единиц данных (Хост-запись)",
        current: 100,
        worst: 100,
        threshold: 0,
        rawDec: 38900450,
        status: "GOOD",
        voices: [
          {
            skill: "ИНТЕРФЕЙС",
            category: "MOT",
            difficulty: "Средне: Успех",
            text: "Около 19.4 ТБ хост-записи при паспортном ресурсе 600 ТБ. Коэффициент усиления записи (Write Amplification) в норме.",
          },
        ],
      },
      {
        id: "0C",
        name: "Power Cycles",
        ruName: "Количество циклов включения питания",
        current: 100,
        worst: 100,
        threshold: 0,
        rawDec: 1412,
        status: "GOOD",
        voices: [
          {
            skill: "ВНУТРЕННЯЯ ИМПЕРИЯ",
            category: "PSY",
            difficulty: "Легко: Успех",
            text: "Тысяча четыреста двенадцать пробуждений из небытия. Каждое утро начинается с подачи +3.3 Вольта на шину.",
          },
        ],
      },
      {
        id: "0D",
        name: "Unsafe Shutdowns",
        ruName: "Небезопасные отключения питания",
        current: 100,
        worst: 100,
        threshold: 0,
        rawDec: 19,
        status: "GOOD",
        voices: [
          {
            skill: "БОЛЕВОЙ ПОРОГ",
            category: "FYS",
            difficulty: "Средне: Успех",
            text: "19 раз рубильник вышибало наживую, без команды Standby Immediate. Конденсаторы успевали сбросить таблицу трансляции адресов (FTL) в последний миг перед темнотой.",
          },
        ],
      },
      {
        id: "0E",
        name: "Media and Data Integrity Errors",
        ruName: "Неисправимые ошибки целостности среды",
        current: 100,
        worst: 100,
        threshold: 0,
        rawDec: 0,
        status: "GOOD",
        voices: [
          {
            skill: "ЛОГИКА",
            category: "INT",
            difficulty: "Легко: Успех",
            text: "Ноль ошибок LDPC-коррекции. Все контрольные суммы сходятся до последнего бита.",
          },
        ],
      },
    ],
  },
  {
    id: "hdd_d",
    letter: "D:",
    name: "АРХИВ ДОПРОСОВ (Магнитный HDD)",
    model: "WDC WD20EZBX-00AYRA0 2000.3 GB",
    capacityGB: 2000.3,
    firmware: "01.01A01",
    serial: "WD-WCC4M8192041",
    interfaceType: "Serial ATA",
    transferMode: "SATA/600 | SATA/600",
    standard: "ACS-3 | ATA8-ACS version 4c",
    features: "S.M.A.R.T., NCQ, GPL",
    healthStatus: "CAUTION",
    healthPercent: 64,
    temperature: 51,
    totalReadsGB: 84120,
    totalWritesGB: 61390,
    powerOnCount: 5340,
    powerOnHours: 34820,
    rotationRate: "7200 RPM",
    introQuote:
      "Из глубины гермоблока доносится глухой металлический скрежет. Шпиндель крутит блины со скоростью 7200 оборотов в минуту уже четыре года подряд. В секторах завелась ржавчина.",
    attributes: [
      {
        id: "01",
        name: "Raw Read Error Rate",
        ruName: "Частота ошибок чтения с магнитной поверхности",
        current: 184,
        worst: 179,
        threshold: 51,
        rawDec: 148,
        status: "GOOD",
        voices: [
          {
            skill: "ИНТЕРФЕЙС",
            category: "MOT",
            difficulty: "Средне: Успех",
            text: "Магниторезистивная головка спотыкается о микродефекты напыления. Пока код Рида — Соломона вытягивает данные со второй попытки.",
          },
        ],
      },
      {
        id: "03",
        name: "Spin-Up Time",
        ruName: "Время раскрутки пакета пластин (мс)",
        current: 162,
        worst: 158,
        threshold: 21,
        rawDec: 4890,
        unit: "мс",
        status: "GOOD",
        voices: [
          {
            skill: "ЭНЦИКЛОПЕДИЯ",
            category: "INT",
            difficulty: "Легко: Успех",
            text: "4.89 секунды от подачи тока на обмотки статора до стабилизации 7200 об/мин. Гидродинамический подшипник ещё держит вязкость смазки.",
          },
        ],
      },
      {
        id: "05",
        name: "Reallocated Sectors Count",
        ruName: "Число переназначенных секторов (Bad Blocks)",
        current: 140,
        worst: 140,
        threshold: 140,
        rawDec: 48,
        status: "CAUTION",
        voices: [
          {
            skill: "БОЛЕВОЙ ПОРОГ",
            category: "FYS",
            difficulty: "Сложно: Успех",
            text: "Сорок восемь шрамов на зеркальной поверхности диска! Контроллер признал эти сектора мёртвыми и перенаправил адреса в резервную зону (Spare Area). Но каждый раз, когда головка ищет их, ей приходится метаться через всю пластину.",
          },
          {
            skill: "ВНУТРЕННЯЯ ИМПЕРИЯ",
            category: "PSY",
            difficulty: "Средне: Успех",
            text: "Так начинается амнезия. Сначала выпадают отдельные слова из старых отчётов за 51-й год. Потом — целые лица.",
          },
        ],
      },
      {
        id: "09",
        name: "Power-On Hours",
        ruName: "Общее время наработки во включённом состоянии",
        current: 53,
        worst: 53,
        threshold: 0,
        rawDec: 34820,
        unit: "ч",
        status: "GOOD",
        voices: [
          {
            skill: "ЛОГИКА",
            category: "INT",
            difficulty: "Легко: Успех",
            text: "34 820 часов — это без малого 4 года непрерывного вращения без сна и выходных. Механический износ вступил в зрелую фазу.",
          },
        ],
      },
      {
        id: "C2",
        name: "Temperature",
        ruName: "Температура гермоблока",
        current: 99,
        worst: 86,
        threshold: 0,
        rawDec: 51,
        unit: "°C",
        status: "CAUTION",
        voices: [
          {
            skill: "СУМРАЧНЫЙ",
            category: "FYS",
            difficulty: "Средне: Успех",
            text: "51 градус для жёсткого диска — это жарковато! Металл расширяется, тепловой дрейф уводит дорожки из-под сервометок.",
          },
        ],
      },
      {
        id: "C5",
        name: "Current Pending Sector Count",
        ruName: "Нестабильные сектора (кандидаты на замену)",
        current: 198,
        worst: 198,
        threshold: 0,
        rawDec: 14,
        status: "CAUTION",
        voices: [
          {
            skill: "ЭНЦИКЛОПЕДИЯ",
            category: "INT",
            difficulty: "Сложно: Успех",
            text: "Атрибут C5h (14 секторов) — самая опасная метрика. Эти сектора уже не читаются, но диск ждёт перезаписи, чтобы проверить, софт-ошибка это или физический кратер. Любой файл, попавший на эти 14 блоков, вызовет зависание ввода-вывода.",
          },
          {
            skill: "АВТОРИТЕТ",
            category: "PSY",
            difficulty: "Легко: Успех",
            text: "Немедленно скопируй отсюда особо важные улики, детектив. Второй попытки этот диск тебе не даст.",
          },
        ],
      },
      {
        id: "C7",
        name: "UltraDMA CRC Error Count",
        ruName: "Ошибки контрольной суммы кабеля SATA (CRC)",
        current: 200,
        worst: 199,
        threshold: 0,
        rawDec: 7,
        status: "GOOD",
        voices: [
          {
            skill: "ИНТЕРФЕЙС",
            category: "MOT",
            difficulty: "Легко: Успех",
            text: "7 ошибок передачи по шлейфу SATA. Скорее всего, окислился контакт или кабель перегнули под крышкой корпуса.",
          },
        ],
      },
    ],
  },
  {
    id: "pale_e",
    letter: "E:",
    name: "КАТУШКА «ФОРТ-МОРАЛЬ» (Поглощён Серотой)",
    model: "SEAGATE ST1000DM003-9YN162 1000.2 GB",
    capacityGB: 1000.2,
    firmware: "CC4B",
    serial: "Z1D4PALE0091",
    interfaceType: "Serial ATA",
    transferMode: "SATA/300 | SATA/600 (Деградация линии)",
    standard: "ATA8-ACS",
    features: "S.M.A.R.T. (АВАРИЙНЫЙ СТАТУС)",
    healthStatus: "BAD",
    healthPercent: 12,
    temperature: 64,
    totalReadsGB: 192400,
    totalWritesGB: 144800,
    powerOnCount: 11204,
    powerOnHours: 68410,
    rotationRate: "7200 RPM (Дисбаланс шпинделя)",
    introQuote:
      "Ритмичное «клац... клац... клац» режет тишину комнаты. Магнитный слой осыпается в микроскопическую пыль. Серота уже внутри гермокамеры — она пожирает файловую таблицу NTFS.",
    attributes: [
      {
        id: "01",
        name: "Raw Read Error Rate",
        ruName: "Частота ошибок чтения поверхности",
        current: 34,
        worst: 31,
        threshold: 6,
        rawDec: 8941204,
        status: "CAUTION",
        voices: [
          {
            skill: "ВНУТРЕННЯЯ ИМПЕРИЯ",
            category: "PSY",
            difficulty: "Невозможно: Успех",
            text: "Восемь миллионов девятьсот тысяч попыток вспомнить то, чего больше нет. Головка бьётся о пустоту, как мотылёк о треснувшее стекло фонаря.",
          },
        ],
      },
      {
        id: "05",
        name: "Reallocated Sectors Count",
        ruName: "Переназначенные сектора (Таблица G-List переполнена)",
        current: 12,
        worst: 12,
        threshold: 36,
        rawDec: 2418,
        status: "BAD",
        voices: [
          {
            skill: "ЛОГИКА",
            category: "INT",
            difficulty: "Легко: Успех",
            text: "Текущее нормализованное значение (12) пробило заводской порог отказа (Threshold = 36). Заводской список дефектов G-List полностью исчерпан — новые битые сектора больше некуда перенаправлять.",
          },
          {
            skill: "БОЛЕВОЙ ПОРОГ",
            category: "FYS",
            difficulty: "Легко: Успех",
            text: "Две тысячи четыреста восемнадцать сквозных ран. Это клиническая смерть магнитного носителя.",
          },
        ],
      },
      {
        id: "0A",
        name: "Spin Retry Count",
        ruName: "Повторные попытки раскрутки шпинделя",
        current: 68,
        worst: 60,
        threshold: 97,
        rawDec: 43,
        status: "BAD",
        voices: [
          {
            skill: "ИНТЕРФЕЙС",
            category: "MOT",
            difficulty: "Средне: Успех",
            text: "43 раза мотор не смог преодолеть заклинивание подшипника с первой подачи тока. Драйверу Smooth L7250 приходится давать форсированный импульс.",
          },
        ],
      },
      {
        id: "C2",
        name: "Temperature",
        ruName: "Критическая температура корпуса",
        current: 36,
        worst: 32,
        threshold: 45,
        rawDec: 64,
        unit: "°C",
        status: "BAD",
        voices: [
          {
            skill: "СТОЙКОСТЬ",
            category: "FYS",
            difficulty: "Средне: Успех",
            text: "64 °C! Трение заклинивающего шпинделя раскаляет алюминиевый корпус до состояния печки. Не прикасайся к нему голыми пальцами.",
          },
        ],
      },
      {
        id: "C6",
        name: "Uncorrectable Sector Count",
        ruName: "Неисправимые ошибки секторов (Фатальная потеря данных)",
        current: 41,
        worst: 41,
        threshold: 0,
        rawDec: 612,
        status: "BAD",
        voices: [
          {
            skill: "ДРАМА",
            category: "INT",
            difficulty: "Средне: Успех",
            text: "612 секторов канули в Сероту навсегда, сир! Никакой `chkdsk /r` и никакая молитва Долорес Дей не вернут эти байты.",
          },
        ],
      },
    ],
  },
];

// ============================================================================
// 3. ПАРСЕР РЕАЛЬНОГО ОТЧЁТА CRYSTALDISKINFO / SMARTCTL
// ============================================================================

function parseRealSmartReport(rawText: string): DriveProfile | null {
  const lines = rawText.split(/\r?\n/);
  if (lines.length < 4) return null;

  let model = "Импортированный накопитель (Полевой терминал)";
  let firmware = "1.00";
  let serial = "REV-0041-X";
  let interfaceType = "NVM Express / SATA";
  let transferMode = "PCIe / SATA-600";
  let temperature = 42;
  let healthPercent = 95;
  let healthStatus: HealthState = "GOOD";
  let powerOnHours = 1200;
  let powerOnCount = 300;
  let totalReadsGB = 5000;
  let totalWritesGB = 4500;

  for (const line of lines) {
    const l = line.trim();
    if (/^(Model|Device Model|Model Number)\s*:/i.test(l)) {
      model = l.split(":")[1]?.trim() || model;
    } else if (/^Firmware(\s+Version)?\s*:/i.test(l)) {
      firmware = l.split(":")[1]?.trim() || firmware;
    } else if (/^Serial\s*Number\s*:/i.test(l)) {
      serial = l.split(":")[1]?.trim() || serial;
    } else if (/^Interface\s*:/i.test(l)) {
      interfaceType = l.split(":")[1]?.trim() || interfaceType;
    } else if (/^Transfer\s*Mode\s*:/i.test(l)) {
      transferMode = l.split(":")[1]?.trim() || transferMode;
    } else if (/^Temperature\s*:/i.test(l)) {
      const m = l.match(/(\d+)\s*C/i);
      if (m) temperature = parseInt(m[1], 10);
    } else if (/^Health\s*Status\s*:/i.test(l)) {
      if (/bad|плох|крит/i.test(l)) healthStatus = "BAD";
      else if (/caution|тревог/i.test(l)) healthStatus = "CAUTION";
      const pm = l.match(/(\d+)\s*%/);
      if (pm) healthPercent = parseInt(pm[1], 10);
    } else if (/^Power\s*On\s*Hours\s*:/i.test(l)) {
      const m = l.match(/(\d+)/);
      if (m) powerOnHours = parseInt(m[1], 10);
    } else if (/^Power\s*On\s*Count\s*:/i.test(l)) {
      const m = l.match(/(\d+)/);
      if (m) powerOnCount = parseInt(m[1], 10);
    } else if (/^Total\s*Host\s*Reads\s*:/i.test(l)) {
      const m = l.match(/(\d+)/);
      if (m) totalReadsGB = parseInt(m[1], 10);
    } else if (/^Total\s*Host\s*Writes\s*:/i.test(l)) {
      const m = l.match(/(\d+)/);
      if (m) totalWritesGB = parseInt(m[1], 10);
    }
  }

  const parsedAttrs: SmartAttribute[] = [];

  for (const line of lines) {
    // 1. Формат CrystalDiskInfo (ATA): ID Cur Wor Thr RawValues(6 байт HEX) AttributeName
    const cdiAta = line.trim().match(/^([0-9A-Fa-f]{2})\s+(\d+)\s+(\d+)\s+(\d+)\s+([0-9A-Fa-f]{8,16})\s+(.+)$/);
    if (cdiAta) {
      const id = cdiAta[1].toUpperCase();
      const cur = parseInt(cdiAta[2], 10);
      const wor = parseInt(cdiAta[3], 10);
      const thr = parseInt(cdiAta[4], 10);
      const rawDec = parseInt(cdiAta[5], 16) || 0;
      const name = cdiAta[6].trim();

      let st: HealthState = "GOOD";
      if (thr > 0 && cur <= thr) st = "BAD";
      else if ((id === "05" || id === "C5" || id === "C6") && rawDec > 0) st = "CAUTION";

      parsedAttrs.push({
        id,
        name,
        ruName: `Атрибут S.M.A.R.T. (${name})`,
        current: cur,
        worst: wor,
        threshold: thr,
        rawDec,
        status: st,
        voices: [
          {
            skill: "ЭНЦИКЛОПЕДИЯ",
            category: "INT",
            difficulty: "Средне: Успех",
            text: `Считан аппаратный регистр ${id}h (${name}). Нормализованное значение: ${cur} (порог отказа: ${thr}), необработанный счётчик RAW: ${rawDec}.`,
          },
          {
            skill: "ИНТЕРФЕЙС",
            category: "MOT",
            difficulty: "Легко: Успех",
            text:
              st === "GOOD"
                ? "Сигнал с датчика чистый, отклонений от заводской калибровки не обнаружено."
                : "Внимание: счётчик зафиксировал аппаратные аномалии на физическом уровне носителя!",
          },
        ],
      });
      continue;
    }

    // 2. Формат CrystalDiskInfo (NVMe): ID RawValues(HEX) AttributeName
    const cdiNvme = line.trim().match(/^([0-9A-Fa-f]{2})\s+([0-9A-Fa-f]{8,16})\s+(.+)$/);
    if (cdiNvme) {
      const id = cdiNvme[1].toUpperCase();
      const rawDec = parseInt(cdiNvme[2], 16) || 0;
      const name = cdiNvme[3].trim();
      parsedAttrs.push({
        id,
        name,
        ruName: `Регистр NVMe (${name})`,
        current: 100,
        worst: 100,
        threshold: 0,
        rawDec,
        status: "GOOD",
        voices: [
          {
            skill: "ИНТЕРФЕЙС",
            category: "MOT",
            difficulty: "Легко: Успех",
            text: `Лог контроллера NVMe [${id}h — ${name}]: десятичное значение счётчика равно ${rawDec.toLocaleString("ru-RU")}.`,
          },
        ],
      });
    }
  }

  if (parsedAttrs.some((a) => a.status === "BAD")) healthStatus = "BAD";
  else if (parsedAttrs.some((a) => a.status === "CAUTION") && healthStatus === "GOOD") {
    healthStatus = "CAUTION";
  }

  return {
    id: `custom_${Date.now()}`,
    letter: "X:",
    name: `ПОЛЕВОЙ ДИСК (${model.slice(0, 22)})`,
    model,
    capacityGB: 1000.0,
    firmware,
    serial,
    interfaceType,
    transferMode,
    standard: "Импорт S.M.A.R.T.-дамп",
    features: "S.M.A.R.T., Пользовательский дамп",
    healthStatus,
    healthPercent,
    temperature,
    totalReadsGB,
    totalWritesGB,
    powerOnCount,
    powerOnHours,
    rotationRate: "Импортировано",
    introQuote:
      "Свежая перфолента загружена прямо в приёмную щель радиокомпьютера. Навыки приступают к вскрытию телеметрии вашего накопителя.",
    attributes:
      parsedAttrs.length > 0
        ? parsedAttrs
        : INITIAL_DRIVES[0].attributes,
  };
}

// ============================================================================
// 4. ЭКСПРЕССИОНИСТСКИЙ SVG-ПОРТРЕТ (ДИНАМИЧЕСКИ РЕАГИРУЕТ НА ЗДОРОВЬЕ И ТЕМПЕРАТУРУ)
// ============================================================================

function DiscoPortrait({
  persona,
  health,
  temp,
}: {
  persona: PersonaId;
  health: HealthState;
  temp: number;
}) {
  const isOverheated = temp >= 55;
  const bgColors =
    health === "GOOD"
      ? ["#1d3532", "#345952", "#c88a3b"]
      : health === "CAUTION"
      ? ["#3a2814", "#7c471c", "#d9822b"]
      : ["#381212", "#6e1b1b", "#d93829"];

  return (
    <svg
      viewBox="0 0 220 260"
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        filter: "contrast(1.12) saturate(1.1)",
      }}
    >
      <defs>
        <linearGradient id="discoBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={bgColors[0]} />
          <stop offset="55%" stopColor={bgColors[1]} />
          <stop offset="100%" stopColor={bgColors[2]} />
        </linearGradient>
        <radialGradient id="heatGlow" cx="50%" cy="45%" r="55%">
          <stop
            offset="0%"
            stopColor={isOverheated ? "#ff3b1f" : "#eab308"}
            stopOpacity={isOverheated ? "0.55" : "0.18"}
          />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Фон в стиле мазков масляной живописи Ростова */}
      <rect width="220" height="260" fill="url(#discoBg)" />
      <circle cx="110" cy="115" r="95" fill="url(#heatGlow)" />

      {/* Экспрессионистские диагональные мазки кисти на фоне */}
      <polygon points="0,40 90,0 130,0 0,85" fill="rgba(255,255,255,0.05)" />
      <polygon points="220,110 120,260 175,260 220,180" fill="rgba(0,0,0,0.28)" />
      <polygon
        points="15,200 205,30 220,55 35,230"
        fill={health === "BAD" ? "rgba(220,38,38,0.18)" : "rgba(212,163,89,0.1)"}
      />

      {/* Нимб мыслей / корона */}
      <circle
        cx="110"
        cy="105"
        r="72"
        fill="none"
        stroke={health === "GOOD" ? "#5fa89a" : health === "CAUTION" ? "#e09f3e" : "#e63946"}
        strokeWidth="2.5"
        strokeDasharray="12 6 4 6"
        opacity="0.7"
      />

      {persona === "harry" && (
        <g>
          {/* Плечи и пиджак РГМ с поднятым воротником */}
          <path
            d="M20,260 L42,188 L78,168 L110,195 L142,168 L178,188 L200,260 Z"
            fill="#242f2b"
            stroke="#111"
            strokeWidth="2"
          />
          {/* Ужасающий галстук (светится при перегреве или ошибке) */}
          <polygon
            points="103,188 117,188 124,258 110,265 96,258"
            fill={isOverheated || health === "BAD" ? "#ff2a1f" : "#c85a32"}
            stroke="#f4d35e"
            strokeWidth="1.5"
          />
          {/* Шея и угловатые скулы */}
          <polygon points="88,145 132,145 138,190 82,190" fill="#b88463" />
          <polygon
            points="66,68 154,68 160,132 136,166 84,166 60,132"
            fill="#d49b78"
            stroke="#2a1b14"
            strokeWidth="2.5"
          />
          {/* Экспрессионистские тени на лице (красноватый нос и щёки) */}
          <polygon points="64,108 98,112 92,142 68,136" fill="rgba(185, 55, 45, 0.48)" />
          <polygon points="156,108 122,112 128,142 152,136" fill="rgba(185, 55, 45, 0.48)" />
          <polygon points="103,95 117,95 122,128 98,128" fill="#ba5648" />
          {/* Густые бакенбарды и усы Кусто ("Выражение") */}
          <path
            d="M60,105 Q55,152 88,162 L92,136 L128,136 L132,162 Q165,152 160,105 L148,108 Q146,135 128,128 L92,128 Q74,135 72,108 Z"
            fill="#3d2b1f"
            stroke="#1b120c"
            strokeWidth="1.5"
          />
          {/* Растрёпанные волосы */}
          <path
            d="M56,88 Q48,42 92,44 Q112,32 142,45 Q174,52 162,92 L148,72 L110,64 L70,74 Z"
            fill="#3a291e"
          />
          {/* Глаза (меняются от состояния диска) */}
          {health === "GOOD" ? (
            <>
              <rect x="76" y="92" width="20" height="8" fill="#1b1917" />
              <rect x="124" y="92" width="20" height="8" fill="#1b1917" />
              <circle cx="86" cy="96" r="2.5" fill="#7dd3fc" />
              <circle cx="134" cy="96" r="2.5" fill="#7dd3fc" />
            </>
          ) : health === "CAUTION" ? (
            <>
              <polygon points="74,88 98,94 96,101 74,97" fill="#1b1917" />
              <polygon points="146,88 122,94 124,101 146,97" fill="#1b1917" />
              <circle cx="86" cy="95" r="2.5" fill="#fbbf24" />
              <circle cx="134" cy="95" r="2.5" fill="#fbbf24" />
            </>
          ) : (
            <>
              <circle cx="86" cy="95" r="8" fill="#1b1917" />
              <circle cx="134" cy="95" r="8" fill="#1b1917" />
              <circle cx="86" cy="95" r="3.5" fill="#ef4444" />
              <circle cx="134" cy="95" r="3.5" fill="#ef4444" />
            </>
          )}
          {/* Ухмылка Кусто или гримаса боли */}
          {health === "BAD" ? (
            <path d="M94,148 Q110,138 126,148" stroke="#111" strokeWidth="3" fill="none" />
          ) : (
            <path d="M92,143 Q110,153 128,142" stroke="#f5ebe0" strokeWidth="2.5" fill="none" />
          )}
        </g>
      )}

      {persona === "kim" && (
        <g>
          {/* Оранжевая куртка-бомбер Кима Кицураги */}
          <path
            d="M18,260 L38,182 L82,166 L110,196 L138,166 L182,182 L202,260 Z"
            fill="#c85a28"
            stroke="#1b1410"
            strokeWidth="2.5"
          />
          {/* Тёмный воротник и белая футболка */}
          <polygon points="82,166 110,202 138,166 126,160 110,182 94,160" fill="#2b2623" />
          {/* Лицо Кима */}
          <polygon
            points="72,68 148,68 152,128 130,162 90,162 68,128"
            fill="#d8a886"
            stroke="#1f1712"
            strokeWidth="2"
          />
          {/* Волосы и пробор */}
          <path d="M68,84 Q70,46 110,46 Q150,46 152,84 L144,68 L76,68 Z" fill="#181615" />
          {/* Культовые очки Кима с бликами */}
          <rect
            x="72"
            y="88"
            width="32"
            height="19"
            rx="2"
            fill="rgba(224, 242, 254, 0.85)"
            stroke="#18181b"
            strokeWidth="2.5"
          />
          <rect
            x="116"
            y="88"
            width="32"
            height="19"
            rx="2"
            fill="rgba(224, 242, 254, 0.85)"
            stroke="#18181b"
            strokeWidth="2.5"
          />
          <line x1="104" y1="95" x2="116" y2="95" stroke="#18181b" strokeWidth="2.5" />
          {/* Усы и спокойная линия рта */}
          <path d="M95,134 L125,134" stroke="#181615" strokeWidth="3" />
          <path
            d={health === "BAD" ? "M98,144 L122,144" : "M98,142 Q110,145 122,142"}
            stroke="#2b1d16"
            strokeWidth="2"
            fill="none"
          />
        </g>
      )}

      {persona === "radiocomputer" && (
        <g>
          {/* Ламповый корпус Радиокомпьютера Сюр-ла-Кле */}
          <rect
            x="46"
            y="42"
            width="128"
            height="178"
            rx="8"
            fill="#23201c"
            stroke="#9a7b4f"
            strokeWidth="3"
          />
          {/* Внутренняя вакуумная колба */}
          <rect
            x="64"
            y="60"
            width="92"
            height="110"
            rx="42"
            fill="#141816"
            stroke="#5c6b64"
            strokeWidth="2"
          />
          {/* Раскалённая нить накала (светится сильнее с ростом температуры) */}
          <path
            d="M86,155 L96,88 L110,122 L124,88 L134,155"
            fill="none"
            stroke={health === "BAD" || isOverheated ? "#ff3b1f" : "#f59e0b"}
            strokeWidth="4"
          />
          <circle
            cx="110"
            cy="108"
            r="26"
            fill={health === "BAD" ? "rgba(239,68,68,0.45)" : "rgba(245,158,11,0.35)"}
          />
          {/* Шкала амперметра внизу */}
          <rect x="64" y="182" width="92" height="24" fill="#d8cbb8" stroke="#111" strokeWidth="1.5" />
          <line
            x1="110"
            y1="204"
            x2={health === "GOOD" ? "92" : health === "CAUTION" ? "115" : "142"}
            y2="185"
            stroke="#991b1b"
            strokeWidth="2.5"
          />
        </g>
      )}

      {/* Рамка портрета с потертостями */}
      <rect
        x="4"
        y="4"
        width="212"
        height="252"
        fill="none"
        stroke="#c2a370"
        strokeWidth="2"
        opacity="0.65"
      />
    </svg>
  );
}

// ============================================================================
// 5. ГЛАВНЫЙ КОМПОНЕНТ «CRYSTAL DISK ELYSIUM // РАДИОКОМПЬЮТЕР РГМ»
// ============================================================================

export default function CrystalDiskElysium() {
  const [drives, setDrives] = useState<DriveProfile[]>(INITIAL_DRIVES);
  const [activeDriveIdx, setActiveDriveIdx] = useState<number>(0);
  const [persona, setPersona] = useState<PersonaId>("harry");
  const [rawFormat, setRawFormat] = useState<"HEX16" | "DEC10">("HEX16");
  const [selectedAttrId, setSelectedAttrId] = useState<string>("05");

  // Симуляция перегрева / деградации на лету
  const [tempOffset, setTempOffset] = useState<number>(0);

  // Модальное окно импорта реального отчёта CrystalDiskInfo / smartctl
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importText, setImportText] = useState<string>("");

  // Реальная оценка браузерного хранилища (Web Storage API)
  const [browserStorage, setBrowserStorage] = useState<{ usedGB: string; quotaGB: string } | null>(
    null
  );

  // Лента диалогов / голосов справа (как в Disco Elysium)
  const [dialogueLog, setDialogueLog] = useState<DialogueEntry[]>([
    {
      id: "init_1",
      timestamp: "08:42",
      skill: "РАДИОКОМПЬЮТЕР РГМ",
      category: "SYS",
      checkResult: "INFO",
      text: "Перфокарта телеметрии S.M.A.R.T. вставлена в считыватель. Нажмите на любую строку таблицы атрибутов или выберите диск сверху, чтобы услышать вердикт навыков.",
    },
    {
      id: "init_2",
      timestamp: "08:42",
      skill: "ЭНЦИКЛОПЕДИЯ",
      category: "INT",
      difficulty: "Легко: Успех",
      checkResult: "SUCCESS",
      text: "Технология S.M.A.R.T. (Self-Monitoring, Analysis and Reporting Technology) была разработана в 1995 году, чтобы предупреждать оператора о неминуемой гибели накопителя за несколько суток до краха.",
    },
    {
      id: "init_3",
      timestamp: "08:43",
      skill: "ВНУТРЕННЯЯ ИМПЕРИЯ",
      category: "PSY",
      difficulty: "Средне: Успех",
      checkResult: "SUCCESS",
      text: "Кремний и намагниченный кобальт помнят всё, что ты удалял в корзину. Даже то, о чём ты предпочёл бы забыть навсегда.",
    },
  ]);

  // Состояние броска кубиков 2d6
  const [lastDiceRoll, setLastDiceRoll] = useState<[number, number] | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then((est) => {
        if (est.quota) {
          setBrowserStorage({
            usedGB: ((est.usage || 0) / (1024 * 1024 * 1024)).toFixed(2),
            quotaGB: (est.quota / (1024 * 1024 * 1024)).toFixed(1),
          });
        }
      });
    }
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [dialogueLog]);

  const activeDrive = drives[activeDriveIdx] || drives[0];
  const effectiveTemp = activeDrive.temperature + tempOffset;

  const effectiveHealth: HealthState = useMemo(() => {
    if (activeDrive.healthStatus === "BAD" || effectiveTemp >= 62) return "BAD";
    if (activeDrive.healthStatus === "CAUTION" || effectiveTemp >= 52) return "CAUTION";
    return "GOOD";
  }, [activeDrive.healthStatus, effectiveTemp]);

  // Переключение накопителя сверху
  const handleSelectDrive = (idx: number) => {
    setActiveDriveIdx(idx);
    setTempOffset(0);
    const drv = drives[idx];
    const now = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

    setDialogueLog((prev) => [
      ...prev,
      {
        id: `drv_${Date.now()}_1`,
        timestamp: now,
        skill: `ПЕРЕКЛЮЧЕНИЕ КАНАЛА // ДИСК ${drv.letter}`,
        category: "SYS",
        checkResult: "INFO",
        text: `${drv.model} (${drv.capacityGB} ГБ). ${drv.introQuote}`,
      },
    ]);
  };

  // Клик по строке S.M.A.R.T.-таблицы вызывает голоса навыков в правой ленте
  const handleInspectAttribute = (attr: SmartAttribute) => {
    setSelectedAttrId(attr.id);
    const now = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

    const newEntries: DialogueEntry[] = attr.voices.map((v, i) => ({
      id: `attr_${attr.id}_${Date.now()}_${i}`,
      timestamp: now,
      skill: v.skill,
      category: v.category,
      difficulty: v.difficulty,
      checkResult: "SUCCESS",
      text: v.text,
      attrId: attr.id,
    }));

    setDialogueLog((prev) => [...prev, ...newEntries]);
  };

  // Белая проверка навыка 2d6 («Постучать по корпусу и считать скрытые сектора»)
  const handleRollSkillCheck = () => {
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    setLastDiceRoll([d1, d2]);

    const bonus = effectiveHealth === "GOOD" ? 3 : effectiveHealth === "CAUTION" ? 1 : -1;
    const total = d1 + d2 + bonus;
    const isSuccess = (d1 === 6 && d2 === 6) || ( !(d1 === 1 && d2 === 1) && total >= 8 );
    const now = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

    if (isSuccess) {
      setDialogueLog((prev) => [
        ...prev,
        {
          id: `roll_${Date.now()}`,
          timestamp: now,
          skill: `ИНТЕРФЕЙС [Кубики: ${d1} + ${d2} (мод. ${bonus >= 0 ? `+${bonus}` : bonus}) = ${total} против 8]`,
          category: "MOT",
          difficulty: "Белая проверка: УСПЕХ",
          checkResult: "SUCCESS",
          text:
            effectiveHealth === "GOOD"
              ? "Твои пальцы ощущают ровную высокочастотную вибрацию дросселей питания. Контроллер мгновенно откликается по шине PCIe: скрытых бэд-блоков за пределами заводской таблицы не обнаружено."
              : "Сквозь гул мотора ты улавливаешь микрозадержку позиционирования на цилиндре #41892. Если сбросить кэш записи прямо сейчас и перенести папку с уликами, ты спасёшь 99.8% архива до того, как поверхность осыплется окончательно!",
        },
      ]);
    } else {
      setDialogueLog((prev) => [
        ...prev,
        {
          id: `roll_${Date.now()}`,
          timestamp: now,
          skill: `РУКА-ГЛАЗ [Кубики: ${d1} + ${d2} (мод. ${bonus >= 0 ? `+${bonus}` : bonus}) = ${total} против 8]`,
          category: "MOT",
          difficulty: "Белая проверка: ПРОВАЛ",
          checkResult: "FAILURE",
          text: "Ты слишком сильно хлопаешь ладонью по пыльной крышке системного блока. Кулер взвывает на максимальных оборотах, а парковочная головка издаёт обиженный щелчок. Лучше не будить лихо, пока оно пишет в таблицу MFT.",
        },
      ]);
    }
  };

  // Импорт реального текстового дампа CrystalDiskInfo
  const handleImportSubmit = () => {
    const parsed = parseRealSmartReport(importText);
    if (!parsed) return;
    const nextDrives = [...drives, parsed];
    setDrives(nextDrives);
    setActiveDriveIdx(nextDrives.length - 1);
    setShowImportModal(false);
    setImportText("");

    const now = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    setDialogueLog((prev) => [
      ...prev,
      {
        id: `imp_${Date.now()}`,
        timestamp: now,
        skill: "ЛОГИКА [Синтез внешнего дампа]",
        category: "INT",
        difficulty: "Легко: Успех",
        checkResult: "SUCCESS",
        text: `В систему загружен реальный накопитель «${parsed.model}». Считано ${parsed.attributes.length} регистров S.M.A.R.T., температура: ${parsed.temperature} °C, наработка: ${parsed.powerOnHours} ч.`,
      },
    ]);
  };

  const formatRawValue = (decVal: number) => {
    if (rawFormat === "DEC10") {
      return decVal.toLocaleString("ru-RU");
    }
    return decVal.toString(16).toUpperCase().padStart(12, "0");
  };

  const skillColor = (cat: DialogueEntry["category"]) => {
    switch (cat) {
      case "INT":
        return "#5fa8d3"; // Голубой Интеллект
      case "PSY":
        return "#9d75cb"; // Фиолетовая Психика
      case "FYS":
        return "#d1495b"; // Бордовая Физика
      case "MOT":
        return "#e09f3e"; // Янтарная Моторика
      default:
        return "#c2a370";
    }
  };

  return (
    <div className="disco-root">
      {/* АВТОНОМНЫЙ CSS В ЭСТЕТИКЕ DISCO ELYSIUM (МАСЛЯНАЯ ЖИВОПИСЬ, ЛАТУНЬ И ЛЕНТА ДИАЛОГОВ) */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        * { box-sizing: border-box; }
        body, html {
          margin: 0;
          padding: 0;
          background-color: #141210;
          color: #e6dcc8;
          font-family: "Georgia", "Times New Roman", "Palatino Linotype", serif;
          font-size: 14px;
          -webkit-font-smoothing: antialiased;
        }
        .mono {
          font-family: "Courier New", "Consolas", "JetBrains Mono", monospace;
          font-variant-numeric: tabular-nums;
        }
        .disco-root {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background:
            radial-gradient(circle at 18% 12%, rgba(194, 90, 50, 0.16), transparent 42%),
            radial-gradient(circle at 75% 85%, rgba(62, 102, 92, 0.18), transparent 45%),
            linear-gradient(180deg, #181512 0%, #12100e 100%);
        }
        /* Верхняя панель выбора дисков (как в CrystalDiskInfo, но в латунной рамке РГМ) */
        .top-deck {
          background: #1b1815;
          border-bottom: 2px solid #6e5a3e;
          padding: 10px 22px;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          box-shadow: 0 6px 20px rgba(0,0,0,0.65);
        }
        .title-plaque {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .rcm-stamp {
          padding: 4px 10px;
          background: #c85a32;
          color: #141210;
          font-weight: 900;
          font-size: 12px;
          letter-spacing: 0.1em;
          border: 1px solid #e6dcc8;
          text-transform: uppercase;
        }
        .app-name {
          font-size: 19px;
          font-weight: 700;
          letter-spacing: 0.04em;
          color: #f3ead8;
          text-transform: uppercase;
          margin: 0;
        }
        .drive-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .drive-tab {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 14px;
          background: #24201c;
          border: 1px solid #524331;
          color: #cbbba0;
          cursor: pointer;
          transition: all 0.15s;
          text-align: left;
        }
        .drive-tab:hover {
          border-color: #c2a370;
          background: #2c2722;
        }
        .drive-tab.active {
          background: linear-gradient(135deg, #36291e, #241d17);
          border: 1.5px solid #d4a359;
          color: #fff;
          box-shadow: 0 0 14px rgba(212, 163, 89, 0.25);
        }
        .status-dot {
          width: 11px;
          height: 11px;
          border-radius: 50%;
          display: inline-block;
          border: 1px solid #111;
        }
        .dot-good { background: #4a9d7c; box-shadow: 0 0 8px #4a9d7c; }
        .dot-caution { background: #e09f3e; box-shadow: 0 0 8px #e09f3e; }
        .dot-bad { background: #d1495b; box-shadow: 0 0 8px #d1495b; }

        /* Кнопки в стиле диалоговых опций Disco Elysium */
        .disco-btn {
          padding: 7px 14px;
          background: #26211d;
          border: 1px solid #7c6647;
          color: #e6dcc8;
          font-family: "Georgia", serif;
          font-size: 12.5px;
          font-weight: 700;
          letter-spacing: 0.03em;
          cursor: pointer;
          transition: all 0.15s;
        }
        .disco-btn:hover {
          background: #c85a32;
          color: #141210;
          border-color: #f3ead8;
        }
        .disco-btn-check {
          background: linear-gradient(135deg, #382c1e, #261e15);
          border: 1.5px solid #e09f3e;
          color: #f4d35e;
        }
        .disco-btn-check:hover {
          background: #e09f3e;
          color: #141210;
        }

        /* Двухколоночная раскладка Disco Elysium: Слева приборная панель CrystalDiskInfo, Справа — Лента Голосов */
        .main-stage {
          flex: 1;
          display: grid;
          grid-template-columns: 1fr 410px;
          min-height: calc(100vh - 64px);
        }
        @media (max-width: 1150px) {
          .main-stage {
            grid-template-columns: 1fr;
          }
        }

        /* Левая часть (CrystalDiskInfo в стиле Ревашоля) */
        .cdi-pane {
          padding: 20px 24px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          overflow-y: auto;
        }
        .cdi-hero {
          display: grid;
          grid-template-columns: 205px 210px 1fr;
          gap: 18px;
          background: rgba(27, 24, 21, 0.9);
          border: 1.5px solid #5c4b37;
          padding: 16px;
          box-shadow: inset 0 0 30px rgba(0,0,0,0.6);
        }
        @media (max-width: 920px) {
          .cdi-hero {
            grid-template-columns: 1fr;
          }
        }
        .portrait-frame {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .portrait-box {
          height: 225px;
          border: 2px solid #8a704c;
          background: #141210;
          overflow: hidden;
        }
        /* Крупные индикаторы CrystalDiskInfo (Техсостояние и Температура) */
        .gauges-col {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 12px;
        }
        .big-gauge {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 12px;
          border: 2px solid #6e5a3e;
          text-align: center;
          position: relative;
        }
        .gauge-good {
          background: linear-gradient(180deg, rgba(42, 82, 70, 0.85), rgba(22, 44, 38, 0.95));
          border-color: #5fa89a;
        }
        .gauge-caution {
          background: linear-gradient(180deg, rgba(110, 68, 22, 0.88), rgba(58, 35, 11, 0.95));
          border-color: #e09f3e;
        }
        .gauge-bad {
          background: linear-gradient(180deg, rgba(115, 26, 26, 0.9), rgba(56, 12, 12, 0.96));
          border-color: #e63946;
        }
        .gauge-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #d8cbb8;
          margin-bottom: 4px;
        }
        .gauge-val {
          font-size: 26px;
          font-weight: 900;
          letter-spacing: 0.03em;
          color: #fff;
          text-shadow: 0 2px 10px rgba(0,0,0,0.7);
        }

        /* Паспорт накопителя справа от индикаторов (как в CrystalDiskInfo) */
        .passport-box {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .drive-title-banner {
          border-bottom: 1.5px solid #5c4b37;
          padding-bottom: 8px;
          margin-bottom: 10px;
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          flex-wrap: wrap;
          gap: 8px;
        }
        .meta-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px 20px;
          font-size: 13px;
        }
        @media (max-width: 680px) {
          .meta-grid { grid-template-columns: 1fr; }
        }
        .meta-row {
          display: flex;
          justify-content: space-between;
          border-bottom: 1px dashed rgba(138, 112, 76, 0.35);
          padding: 4px 0;
        }
        .meta-key {
          color: #a89984;
          font-size: 12.5px;
        }
        .meta-val {
          color: #f3ead8;
          font-weight: 700;
          text-align: right;
        }

        /* Таблица S.M.A.R.T. */
        .smart-panel {
          background: rgba(24, 21, 18, 0.92);
          border: 1.5px solid #5c4b37;
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        .smart-header {
          padding: 10px 16px;
          background: #231f1b;
          border-bottom: 1.5px solid #5c4b37;
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }
        .smart-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .smart-table th {
          background: #1a1714;
          color: #b5a48b;
          text-align: left;
          padding: 9px 12px;
          border-bottom: 1.5px solid #5c4b37;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .smart-table td {
          padding: 8px 12px;
          border-bottom: 1px solid rgba(92, 75, 55, 0.35);
          color: #e6dcc8;
        }
        .smart-table tr {
          cursor: pointer;
          transition: background 0.12s;
        }
        .smart-table tr:hover td {
          background: rgba(200, 90, 50, 0.16);
        }
        .smart-table tr.selected-row td {
          background: rgba(212, 163, 89, 0.22);
          border-top: 1px solid #d4a359;
          border-bottom: 1px solid #d4a359;
        }

        /* ПРАВАЯ КОЛОНКА — ИКОНИЧЕСКАЯ ЛЕНТА МЫСЛЕЙ DISCO ELYSIUM */
        .dialogue-column {
          background:
            linear-gradient(180deg, #1b1714 0%, #120f0d 100%);
          border-left: 2px solid #6e5a3e;
          display: flex;
          flex-direction: column;
          height: calc(100vh - 64px);
          position: sticky;
          top: 64px;
          box-shadow: -8px 0 28px rgba(0,0,0,0.7);
        }
        @media (max-width: 1150px) {
          .dialogue-column {
            height: 600px;
            position: static;
            border-left: none;
            border-top: 2px solid #6e5a3e;
          }
        }
        .dialogue-header {
          padding: 12px 18px;
          background: #231e1a;
          border-bottom: 1.5px solid #5c4b37;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .dialogue-scroll {
          flex: 1;
          overflow-y: auto;
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .thought-entry {
          border-left: 3px solid #c85a32;
          padding-left: 13px;
          line-height: 1.58;
          animation: fadeIn 0.25s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .skill-title {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-weight: 900;
          font-size: 12.5px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .skill-diff {
          font-size: 11.5px;
          color: #9e8f79;
          margin-left: 6px;
          font-style: italic;
        }
        .thought-text {
          margin-top: 4px;
          color: #f0e6d2;
          font-size: 14px;
        }
        .dialogue-footer {
          padding: 14px 18px;
          background: #1f1a16;
          border-top: 1.5px solid #5c4b37;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .dice-box {
          display: inline-flex;
          gap: 6px;
          align-items: center;
        }
        .die-cube {
          width: 24px;
          height: 24px;
          background: #f3ead8;
          color: #141210;
          font-weight: 900;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 3px;
          border: 1px solid #111;
        }
      `,
        }}
      />

      {/* ВЕРХНЯЯ ПАНЕЛЬ НАКОПИТЕЛЕЙ И ИМПОРТА */}
      <header className="top-deck">
        <div className="title-plaque">
          <span className="rcm-stamp mono">РГМ // S.M.A.R.T.</span>
          <div>
            <h1 className="app-name">CrystalDisk // Elysium Edition</h1>
          </div>
        </div>

        {/* Вкладки дисков (как в CrystalDiskInfo) */}
        <div className="drive-tabs">
          {drives.map((drv, idx) => {
            const dotClass =
              drv.healthStatus === "GOOD"
                ? "dot-good"
                : drv.healthStatus === "CAUTION"
                ? "dot-caution"
                : "dot-bad";
            return (
              <button
                key={drv.id}
                onClick={() => handleSelectDrive(idx)}
                className={`drive-tab ${idx === activeDriveIdx ? "active" : ""}`}
              >
                <span className={`status-dot ${dotClass}`} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: "13px" }}>
                    [{drv.letter}] {drv.healthPercent}% • {drv.temperature} °C
                  </div>
                  <div style={{ fontSize: "11px", color: "#9e8f79" }}>
                    {drv.capacityGB} ГБ — {drv.name.slice(0, 22)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={() => setShowImportModal(true)} className="disco-btn">
            + Вставить свой отчёт CDI / smartctl
          </button>
          <button
            onClick={() => setRawFormat((p) => (p === "HEX16" ? "DEC10" : "HEX16"))}
            className="disco-btn mono"
          >
            RAW: {rawFormat === "HEX16" ? "16 [HEX]" : "10 [DEC]"}
          </button>
        </div>
      </header>

      {/* ГЛАВНАЯ СЦЕНА: ПРИБОРНАЯ ДОСКА СЛЕВА + ЛЕНТА МЫСЛЕЙ СПРАВА */}
      <div className="main-stage">
        {/* ЛЕВАЯ ЧАСТЬ: CRYSTALDISKINFO В ЭСТЕТИКЕ РЕВАШОЛЯ */}
        <main className="cdi-pane">
          <div className="cdi-hero">
            {/* 1. Экспрессионистский портрет с переключателем персонажа */}
            <div className="portrait-frame">
              <div className="portrait-box">
                <DiscoPortrait persona={persona} health={effectiveHealth} temp={effectiveTemp} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "4px" }}>
                {[
                  { id: "harry", label: "Гарри" },
                  { id: "kim", label: "Ким" },
                  { id: "radiocomputer", label: "Лампа" },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPersona(p.id as PersonaId)}
                    className="disco-btn"
                    style={{
                      padding: "4px 6px",
                      fontSize: "11px",
                      background: persona === p.id ? "#c85a32" : "#26211d",
                      color: persona === p.id ? "#141210" : "#e6dcc8",
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Два больших фирменных индикатора CrystalDiskInfo: Техсостояние и Температура */}
            <div className="gauges-col">
              <div
                className={`big-gauge ${
                  effectiveHealth === "GOOD"
                    ? "gauge-good"
                    : effectiveHealth === "CAUTION"
                    ? "gauge-caution"
                    : "gauge-bad"
                }`}
              >
                <div className="gauge-label">Техсостояние носителя</div>
                <div className="gauge-val">
                  {effectiveHealth === "GOOD"
                    ? "ХОРОШО"
                    : effectiveHealth === "CAUTION"
                    ? "ТРЕВОГА"
                    : "СЕРОТА (КРИТ.)"}
                </div>
                <div className="mono" style={{ fontSize: "20px", fontWeight: 700, marginTop: "4px", color: "#f3ead8" }}>
                  {activeDrive.healthPercent} %
                </div>
              </div>

              <div
                className={`big-gauge ${
                  effectiveTemp < 50
                    ? "gauge-good"
                    : effectiveTemp < 60
                    ? "gauge-caution"
                    : "gauge-bad"
                }`}
              >
                <div className="gauge-label">Температура кристалла</div>
                <div className="gauge-val mono">{effectiveTemp} °C</div>
                <div style={{ width: "100%", marginTop: "8px" }}>
                  <input
                    type="range"
                    min={-10}
                    max={30}
                    value={tempOffset}
                    onChange={(e) => setTempOffset(Number(e.target.value))}
                    title="Симуляция тепловой нагрузки на накопитель"
                    style={{ width: "100%", accentColor: "#c85a32", cursor: "pointer" }}
                  />
                  <div style={{ fontSize: "10px", color: "#d8cbb8" }}>
                    Регулятор нагрева ({tempOffset >= 0 ? `+${tempOffset}` : tempOffset} °C)
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Паспортные данные накопителя (Firmware, Serial, Interface, TBW, Hours) */}
            <div className="passport-box">
              <div>
                <div className="drive-title-banner">
                  <div>
                    <h2 style={{ margin: 0, fontSize: "20px", color: "#f4d35e", letterSpacing: "0.02em" }}>
                      {activeDrive.model} ({activeDrive.capacityGB} ГБ)
                    </h2>
                    <p style={{ margin: "4px 0 0 0", fontSize: "12.5px", color: "#cbbba0", fontStyle: "italic" }}>
                      «{activeDrive.introQuote}»
                    </p>
                  </div>
                </div>

                <div className="meta-grid">
                  <div className="meta-row">
                    <span className="meta-key">Прошивка (Firmware):</span>
                    <span className="meta-val mono">{activeDrive.firmware}</span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-key">Всего хост-чтений:</span>
                    <span className="meta-val mono">{activeDrive.totalReadsGB.toLocaleString("ru-RU")} ГБ</span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-key">Серийный номер:</span>
                    <span className="meta-val mono">{activeDrive.serial}</span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-key">Всего хост-записей:</span>
                    <span className="meta-val mono">{activeDrive.totalWritesGB.toLocaleString("ru-RU")} ГБ</span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-key">Интерфейс:</span>
                    <span className="meta-val mono">{activeDrive.interfaceType}</span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-key">Число включений:</span>
                    <span className="meta-val mono">{activeDrive.powerOnCount.toLocaleString("ru-RU")} раз</span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-key">Режим передачи:</span>
                    <span className="meta-val mono">{activeDrive.transferMode}</span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-key">Общее время работы:</span>
                    <span className="meta-val mono">
                      {activeDrive.powerOnHours.toLocaleString("ru-RU")} ч ({Math.round(activeDrive.powerOnHours / 24)} дн.)
                    </span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-key">Стандарт / Скорость:</span>
                    <span className="meta-val mono">{activeDrive.rotationRate}</span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-key">Возможности:</span>
                    <span className="meta-val mono">{activeDrive.features}</span>
                  </div>
                </div>
              </div>

              {browserStorage && (
                <div
                  style={{
                    marginTop: "12px",
                    padding: "7px 12px",
                    background: "rgba(95, 168, 154, 0.12)",
                    border: "1px solid #4a6b65",
                    fontSize: "12px",
                    color: "#a7d7c5",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span>Реальная телеметрия локального тома браузера:</span>
                  <span className="mono">
                    Выделено квоты: {browserStorage.quotaGB} ГБ (исп. {browserStorage.usedGB} ГБ)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ТАБЛИЦА РЕГИСТРОВ S.M.A.R.T. */}
          <div className="smart-panel">
            <div className="smart-header">
              <div>
                <strong style={{ fontSize: "14px", letterSpacing: "0.04em", textTransform: "uppercase", color: "#f3ead8" }}>
                  Телеметрия регистров S.M.A.R.T. (Нажмите на любую строку для допроса сектора)
                </strong>
              </div>
              <span style={{ fontSize: "12px", color: "#b5a48b" }}>
                Активный регистр: <strong className="mono" style={{ color: "#f4d35e" }}>{selectedAttrId}h</strong>
              </span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="smart-table">
                <thead>
                  <tr>
                    <th style={{ width: "44px" }}>Стат.</th>
                    <th style={{ width: "54px" }}>ID</th>
                    <th>Имя атрибута / Назначение регистра</th>
                    <th style={{ textAlign: "right" }}>Текущее</th>
                    <th style={{ textAlign: "right" }}>Худшее</th>
                    <th style={{ textAlign: "right" }}>Порог</th>
                    <th style={{ textAlign: "right" }}>
                      RAW-значения ({rawFormat === "HEX16" ? "HEX" : "DEC"})
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activeDrive.attributes.map((attr) => {
                    const dotClass =
                      attr.status === "GOOD"
                        ? "dot-good"
                        : attr.status === "CAUTION"
                        ? "dot-caution"
                        : "dot-bad";
                    const isSel = selectedAttrId === attr.id;
                    return (
                      <tr
                        key={attr.id}
                        onClick={() => handleInspectAttribute(attr)}
                        className={isSel ? "selected-row" : ""}
                      >
                        <td style={{ textAlign: "center" }}>
                          <span className={`status-dot ${dotClass}`} />
                        </td>
                        <td className="mono" style={{ fontWeight: 700, color: "#d4a359" }}>
                          {attr.id}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: "#f3ead8" }}>{attr.name}</div>
                          <div style={{ fontSize: "11.5px", color: "#a89984" }}>{attr.ruName}</div>
                        </td>
                        <td className="mono" style={{ textAlign: "right" }}>
                          {attr.current}
                        </td>
                        <td className="mono" style={{ textAlign: "right", color: "#b5a48b" }}>
                          {attr.worst}
                        </td>
                        <td className="mono" style={{ textAlign: "right", color: "#9e8f79" }}>
                          {attr.threshold}
                        </td>
                        <td
                          className="mono"
                          style={{
                            textAlign: "right",
                            fontWeight: 700,
                            color:
                              attr.status === "BAD"
                                ? "#f87171"
                                : attr.status === "CAUTION"
                                ? "#fbbf24"
                                : "#a7f3d0",
                          }}
                        >
                          {formatRawValue(attr.rawDec)}
                          {attr.unit && rawFormat === "DEC10" ? ` ${attr.unit}` : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </main>

        {/* ПРАВАЯ КОЛОНКА: ИКОНИЧЕСКАЯ ЛЕНТА МЫСЛЕЙ DISCO ELYSIUM */}
        <aside className="dialogue-column">
          <div className="dialogue-header">
            <div>
              <div style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#f4d35e" }}>
                Лента внутреннего диалога
              </div>
              <div style={{ fontSize: "11px", color: "#9e8f79" }}>
                Голоса навыков анализируют физику носителя
              </div>
            </div>
            <button
              onClick={() => setDialogueLog((prev) => prev.slice(-1))}
              className="disco-btn"
              style={{ padding: "4px 9px", fontSize: "11px" }}
            >
              Очистить
            </button>
          </div>

          <div className="dialogue-scroll">
            {dialogueLog.map((entry) => (
              <div
                key={entry.id}
                className="thought-entry"
                style={{ borderLeftColor: skillColor(entry.category) }}
              >
                <div>
                  <span className="skill-title" style={{ color: skillColor(entry.category) }}>
                    {entry.skill}
                  </span>
                  {entry.difficulty && <span className="skill-diff">[{entry.difficulty}]</span>}
                </div>
                <div className="thought-text">— {entry.text}</div>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>

          {/* Нижний блок с Белой проверкой 2d6 */}
          <div className="dialogue-footer">
            <button onClick={handleRollSkillCheck} className="disco-btn disco-btn-check">
              🎲 [ИНТЕРФЕЙС — Средне 8] Приложить ухо к корпусу и прощупать скрытые сектора
            </button>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11.5px", color: "#a89984" }}>
              <span>Шанс успеха зависит от здоровья диска</span>
              {lastDiceRoll && (
                <span className="dice-box mono">
                  <span>Бросок:</span>
                  <span className="die-cube">{lastDiceRoll[0]}</span>
                  <span className="die-cube">{lastDiceRoll[1]}</span>
                </span>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* МОДАЛЬНОЕ ОКНО ИМПОРТА НАСТОЯЩЕГО ОТЧЁТА CRYSTALDISKINFO */}
      {showImportModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.78)",
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "660px",
              background: "#1b1815",
              border: "2px solid #c2a370",
              padding: "22px",
              boxShadow: "0 18px 50px rgba(0,0,0,0.85)",
            }}
          >
            <h3 style={{ margin: "0 0 8px 0", color: "#f4d35e", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Вставка реального дампа CrystalDiskInfo (`Правка → Копировать`)
            </h3>
            <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "#cbbba0" }}>
              Откройте обычный CrystalDiskInfo у себя на ПК, нажмите `Ctrl + C` (это копирует весь текстовый отчёт со всеми регистрами S.M.A.R.T.) и вставьте его в поле ниже:
            </p>
            <textarea
              rows={10}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={
                "Model : Samsung SSD 980 1TB\nFirmware : 3B4QFXO7\nTemperature : 39 C\nHealth Status : Good (99 %)\n01 100 100 0 000000000000 Raw Read Error Rate\n05 100 100 10 000000000002 Reallocated Sectors Count"
              }
              className="mono"
              style={{
                width: "100%",
                background: "#110f0d",
                border: "1px solid #6e5a3e",
                color: "#f3ead8",
                padding: "10px",
                fontSize: "12px",
                marginBottom: "14px",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button onClick={() => setShowImportModal(false)} className="disco-btn">
                Отмена
              </button>
              <button onClick={handleImportSubmit} className="disco-btn disco-btn-check">
                Распознать перфоленту S.M.A.R.T.
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
