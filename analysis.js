(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.DeltaScopeAnalysis = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const localeContent = {
    es: {
      actions: {
        scope: [
          "Actualizar backlog y criterios de aceptación",
          "Validar alcance con cliente y documentar decisiones",
        ],
        schedule: [
          "Revisar plan de proyecto y ajustar hitos",
          "Comunicar impacto en fechas a stakeholders",
        ],
        cost: [
          "Recalcular estimaciones y preparar change request",
          "Revisar presupuesto y aprobaciones",
        ],
        risk: [
          "Actualizar registro de riesgos y mitigaciones",
          "Definir owner y seguimiento del riesgo",
        ],
        compliance: [
          "Revisar con legal/compliance y actualizar evidencias",
          "Ajustar controles de seguridad y auditoría",
        ],
        testing: [
          "Actualizar plan de pruebas y casos",
          "Planificar ejecución de pruebas adicionales",
        ],
        general: ["Registrar el cambio en el log oficial"],
      },
      reasons: {
        scope: "Cambio en alcance o requisitos",
        schedule: "Cambio en fechas o plazos",
        cost: "Cambio en costes o presupuesto",
        risk: "Cambio relacionado con riesgos",
        compliance: "Cambio en compliance o seguridad",
        testing: "Cambio en testing o validación",
        dateChange: "Cambio de fecha detectado",
        numberChange: "Cambio numérico detectado",
      },
      summaryFallback: "Cambio detectado",
      escalateAction: "Escalar a stakeholders clave y registrar CR",
      logAction: "Actualizar log de cambios con evidencia",
    },
    en: {
      actions: {
        scope: [
          "Update backlog and acceptance criteria",
          "Confirm scope with client and document decisions",
        ],
        schedule: [
          "Review project plan and adjust milestones",
          "Communicate schedule impact to stakeholders",
        ],
        cost: [
          "Recalculate estimates and prepare change request",
          "Review budget and approvals",
        ],
        risk: [
          "Update risk register and mitigations",
          "Assign owner and follow-up for the risk",
        ],
        compliance: [
          "Review with legal/compliance and update evidence",
          "Adjust security controls and audit trail",
        ],
        testing: [
          "Update test plan and cases",
          "Plan additional test execution",
        ],
        general: ["Log the change in the official register"],
      },
      reasons: {
        scope: "Scope or requirement change",
        schedule: "Schedule or date change",
        cost: "Cost or budget change",
        risk: "Risk related change",
        compliance: "Compliance or security change",
        testing: "Testing or validation change",
        dateChange: "Date change detected",
        numberChange: "Numeric change detected",
      },
      summaryFallback: "Change detected",
      escalateAction: "Escalate to key stakeholders and log a CR",
      logAction: "Update change log with evidence",
    },
  };

  function normalizeLang(lang) {
    return lang === "en" ? "en" : "es";
  }

  function analyze(baselineText, revisedText, options = {}) {
    const lang = normalizeLang(options.lang);
    const changes = buildChanges(baselineText, revisedText, lang);
    return { changes };
  }

  function buildChanges(baselineText, revisedText, lang) {
    const locale = normalizeLang(lang);
    const baseLines = parseLines(baselineText || "");
    const revisedLines = parseLines(revisedText || "");
    const ops = diffLines(baseLines, revisedLines);
    const grouped = groupOps(ops, locale);
    return grouped.map((change, index) => ({
      ...change,
      id: hashString(`${change.section}|${change.oldText}|${change.newText}`),
      index,
    }));
  }

  function parseLines(text) {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    let section = "General";
    return lines.map((line) => {
      const heading = detectHeading(line);
      if (heading) {
        section = heading;
      }
      return { text: line, section };
    });
  }

  function detectHeading(line) {
    const md = line.match(/^#{1,6}\s+(.+)/);
    if (md) {
      return md[1].trim();
    }
    const numbered = line.match(/^(\d+(?:\.\d+)*)(?:\s+|-)(.+)/);
    if (numbered && numbered[2].length < 80) {
      return `${numbered[1]} ${numbered[2].trim()}`;
    }
    const upper = line.match(/^[A-Z0-9\s\-]{6,}$/);
    if (upper) {
      return line.trim();
    }
    const keyword = line.match(
      /^(Seccion|Sección|Capitulo|Capítulo|Anexo|Scope|Alcance|Plazos|Cronograma|Seguridad|Compliance|Riesgos|Testing)[\s:-]+(.+)?/i,
    );
    if (keyword) {
      return line.trim();
    }
    return null;
  }

  function diffLines(baseLines, revisedLines) {
    const a = baseLines.map((line) => line.text);
    const b = revisedLines.map((line) => line.text);
    const n = a.length;
    const m = b.length;
    const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

    for (let i = n - 1; i >= 0; i -= 1) {
      for (let j = m - 1; j >= 0; j -= 1) {
        if (a[i] === b[j]) {
          dp[i][j] = dp[i + 1][j + 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
    }

    let i = 0;
    let j = 0;
    const ops = [];
    while (i < n && j < m) {
      if (a[i] === b[j]) {
        ops.push({ type: "equal", text: a[i], section: baseLines[i].section });
        i += 1;
        j += 1;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        ops.push({ type: "delete", text: a[i], section: baseLines[i].section });
        i += 1;
      } else {
        ops.push({ type: "insert", text: b[j], section: revisedLines[j].section });
        j += 1;
      }
    }
    while (i < n) {
      ops.push({ type: "delete", text: a[i], section: baseLines[i].section });
      i += 1;
    }
    while (j < m) {
      ops.push({ type: "insert", text: b[j], section: revisedLines[j].section });
      j += 1;
    }
    return ops;
  }

  function groupOps(ops, lang) {
    const changes = [];
    let buffer = [];

    const flush = () => {
      if (!buffer.length) {
        return;
      }
      const deletions = buffer.filter((item) => item.type === "delete");
      const insertions = buffer.filter((item) => item.type === "insert");
      const oldText = deletions.map((item) => item.text).join("\n");
      const newText = insertions.map((item) => item.text).join("\n");
      const section =
        insertions[0]?.section || deletions[0]?.section || "General";

      const changeType = oldText && newText ? "modified" : newText ? "added" : "removed";
      const classification = classifyChange(oldText, newText, lang);
      const summary = createSummary(oldText, newText, changeType, lang);

      changes.push({
        section,
        oldText,
        newText,
        changeType,
        summary,
        ...classification,
      });

      buffer = [];
    };

    ops.forEach((item) => {
      if (item.type === "equal") {
        flush();
      } else {
        buffer.push(item);
      }
    });
    flush();
    return changes;
  }

  function classifyChange(oldText, newText, lang) {
    const locale = localeContent[lang];
    const combined = `${oldText} ${newText}`.toLowerCase();
    const areas = [];
    const reasons = [];

    const addArea = (area, reason) => {
      if (!areas.includes(area)) {
        areas.push(area);
      }
      if (reason) {
        reasons.push(reason);
      }
    };

    if (/(alcance|scope|deliverable|requisito|funcionalidad|feature)/.test(combined)) {
      addArea("scope", locale.reasons.scope);
    }
    if (/(fecha|plazo|cronograma|hito|deadline|go-live|calendario)/.test(combined)) {
      addArea("schedule", locale.reasons.schedule);
    }
    if (/(coste|costo|budget|presupuesto|importe|precio|tarifa|payment)/.test(combined)) {
      addArea("cost", locale.reasons.cost);
    }
    if (/(riesgo|mitigacion|impacto|dependencia|bloqueo)/.test(combined)) {
      addArea("risk", locale.reasons.risk);
    }
    if (/(compliance|legal|gdpr|iso|regulatorio|seguridad|privacy|auditor[ií]a)/.test(combined)) {
      addArea("compliance", locale.reasons.compliance);
    }
    if (/(test|qa|prueba|validaci[oó]n|verification|testing)/.test(combined)) {
      addArea("testing", locale.reasons.testing);
    }

    const numberChange = detectNumberChange(oldText, newText);
    const dateChange = detectDateChange(oldText, newText);

    if (dateChange) {
      addArea("schedule", locale.reasons.dateChange);
    }
    if (numberChange) {
      reasons.push(locale.reasons.numberChange);
    }

    if (areas.length === 0) {
      areas.push("general");
    }

    let severity = "low";
    if (areas.includes("compliance") || areas.includes("risk")) {
      severity = "high";
    }
    if (areas.includes("schedule") || areas.includes("cost") || areas.includes("scope")) {
      severity = severity === "high" ? "high" : "medium";
    }
    if (/(penal|multa|cr[ií]tico|obligatorio|shall|must|security|penalizaci[oó]n)/.test(combined)) {
      severity = "high";
    }
    if (numberChange && severity === "low") {
      severity = "medium";
    }

    const actions = collectActions(areas, severity, lang);

    return {
      areas,
      reasons,
      severity,
      actions,
    };
  }

  function detectNumberChange(oldText, newText) {
    if (!oldText || !newText) {
      return false;
    }
    const extract = (text) =>
      (text.match(/\b\d{1,4}(?:[.,]\d+)?\b/g) || []).join("|");
    return extract(oldText) !== extract(newText);
  }

  function detectDateChange(oldText, newText) {
    if (!oldText || !newText) {
      return false;
    }
    const dateRegex =
      /(\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b)/i;
    return dateRegex.test(oldText) || dateRegex.test(newText);
  }

  function collectActions(areas, severity, lang) {
    const locale = localeContent[lang];
    const actions = new Set();
    areas.forEach((area) => {
      (locale.actions[area] || []).forEach((action) => actions.add(action));
    });
    if (severity === "high") {
      actions.add(locale.escalateAction);
    }
    actions.add(locale.logAction);
    return Array.from(actions);
  }

  function createSummary(oldText, newText, changeType, lang) {
    const source = changeType === "added" ? newText : oldText || newText;
    const fallback = localeContent[lang].summaryFallback;
    const firstLine = source.split("\n")[0] || fallback;
    return truncate(firstLine, 120);
  }

  function truncate(value, max) {
    if (value.length <= max) {
      return value;
    }
    return `${value.slice(0, max - 3)}...`;
  }

  function hashString(value) {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return `c_${Math.abs(hash)}`;
  }

  return {
    analyze,
    buildChanges,
  };
});
