import type { Analytics } from '@/domain/analytics'

/** Quote a CSV cell and neutralise spreadsheet formulas (a leading = + - @ would otherwise run in Excel). */
export function csvCell(v: string | number): string {
  let s = String(v)
  if (/^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const row = (cells: (string | number)[]) => cells.map(csvCell).join(',')

/** One CSV with labelled sections, readable in Excel or Google Sheets. */
export function analyticsToCsv(a: Analytics): string {
  const lines: string[] = []
  lines.push(row(['Busly operations report']), row(['Generated', new Date(a.generatedAt).toISOString()]), row(['History days', a.historyDays]), '')
  lines.push(row(['Summary']), row(['Average trip (min)', a.avgTripDurationMin]), row(['Average delay (min)', a.avgDelayMin]), row(['Completion rate (%)', a.completionRate]), row(['ETA accuracy (%)', a.etaAccuracy]), '')
  lines.push(row(['Routes']), row(['Code', 'Name', 'Trips', 'Average peak load (%)', 'Average delay (min)']))
  for (const r of a.mostUsedRoutes) lines.push(row([r.code, r.name, r.trips, r.avgOccupancy, a.mostDelayedRoutes.find((x) => x.routeId === r.routeId)?.avgDelay ?? 0]))
  lines.push('', row(['Hourly']), row(['Hour', 'Trips', 'Average delay (min)', 'Average load (%)']))
  for (const h of a.hourly.filter((x) => x.trips > 0)) lines.push(row([h.hour, h.trips, h.avgDelay, h.avgOccupancy]))
  lines.push('', row(['Insights']), row(['Type', 'Severity', 'Title', 'Why', 'Evidence']))
  for (const i of a.insights) lines.push(row([i.kind, i.severity, i.title, i.why, i.evidence.map((e) => `${e.label}: ${e.value}`).join('; ')]))
  return lines.join('\r\n')
}

export function downloadText(filename: string, text: string, mime = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob(['﻿', text], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
