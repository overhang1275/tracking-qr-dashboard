import type { ValidationRecord } from "../types";
export interface ValidationFilters {
  search?: string;
  documentType?: string;
  elementType?: string;
  result?: string;
  userId?: string;
  start?: number;
  end?: number;
}
export function filterValidations(
  rows: ValidationRecord[],
  filters: ValidationFilters,
) {
  const needle = filters.search?.trim().toLocaleLowerCase("es");
  return rows.filter(
    (row) =>
      (!filters.documentType || row.documentType === filters.documentType) &&
      (!filters.elementType || row.elementType === filters.elementType) &&
      (!filters.result || row.reportedResult === filters.result) &&
      (!filters.userId || row.userId === filters.userId) &&
      (filters.start === undefined || row.timestamp >= filters.start) &&
      (filters.end === undefined || row.timestamp <= filters.end) &&
      (!needle ||
        [row.folio, row.userId, row.application, row.appVersion].some((value) =>
          value.toLocaleLowerCase("es").includes(needle),
        )),
  );
}
function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text))
    text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function validationsToCsv(rows: ValidationRecord[]) {
  const fields = [
    "id",
    "userId",
    "folio",
    "documentType",
    "elementType",
    "reportedResult",
    "timestamp",
    "application",
    "appVersion",
  ] as const;
  return (
    "\uFEFF" +
    [
      fields.map(csvCell).join(","),
      ...rows.map((row) =>
        fields.map((field) => csvCell(row[field])).join(","),
      ),
    ].join("\r\n")
  );
}
export function downloadCsv(rows: ValidationRecord[]) {
  const url = URL.createObjectURL(
    new Blob([validationsToCsv(rows)], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "validaciones.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
