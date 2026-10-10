// Iconos Lucide (licencia ISC) importados como texto SVG en tiempo de compilación
// (Vite resuelve el sufijo "?raw"). No hay ninguna petición a un CDN en tiempo de ejecución.
import layoutDashboard from 'lucide-static/icons/layout-dashboard.svg?raw';
import listChecks from 'lucide-static/icons/list-checks.svg?raw';
import fileText from 'lucide-static/icons/file-text.svg?raw';
import calendar from 'lucide-static/icons/calendar.svg?raw';
import lineChart from 'lucide-static/icons/line-chart.svg?raw';
import printer from 'lucide-static/icons/printer.svg?raw';
import plus from 'lucide-static/icons/plus.svg?raw';
import plusCircle from 'lucide-static/icons/plus-circle.svg?raw';
import pencil from 'lucide-static/icons/pencil.svg?raw';
import editThree from 'lucide-static/icons/edit-3.svg?raw';
import trash from 'lucide-static/icons/trash-2.svg?raw';
import download from 'lucide-static/icons/download.svg?raw';
import search from 'lucide-static/icons/search.svg?raw';
import x from 'lucide-static/icons/x.svg?raw';
import circleCheck from 'lucide-static/icons/circle-check.svg?raw';
import checkCircleTwo from 'lucide-static/icons/check-circle-2.svg?raw';
import check from 'lucide-static/icons/check.svg?raw';
import circleAlert from 'lucide-static/icons/circle-alert.svg?raw';
import triangleAlert from 'lucide-static/icons/triangle-alert.svg?raw';
import info from 'lucide-static/icons/info.svg?raw';
import clock from 'lucide-static/icons/clock.svg?raw';
import users from 'lucide-static/icons/users.svg?raw';
import target from 'lucide-static/icons/target.svg?raw';
import shieldCheck from 'lucide-static/icons/shield-check.svg?raw';
import trendingUp from 'lucide-static/icons/trending-up.svg?raw';
import chevronLeft from 'lucide-static/icons/chevron-left.svg?raw';
import chevronRight from 'lucide-static/icons/chevron-right.svg?raw';
import save from 'lucide-static/icons/save.svg?raw';
import arrowRight from 'lucide-static/icons/arrow-right.svg?raw';
import arrowRightCircle from 'lucide-static/icons/arrow-right-circle.svg?raw';
import rotateCcw from 'lucide-static/icons/rotate-ccw.svg?raw';
import loaderCircle from 'lucide-static/icons/loader-circle.svg?raw';
import cloud from 'lucide-static/icons/cloud.svg?raw';
import cloudOff from 'lucide-static/icons/cloud-off.svg?raw';
import link from 'lucide-static/icons/link.svg?raw';
import unlink from 'lucide-static/icons/unlink.svg?raw';
import logOut from 'lucide-static/icons/log-out.svg?raw';
import keyRound from 'lucide-static/icons/key-round.svg?raw';
import database from 'lucide-static/icons/database.svg?raw';
import inbox from 'lucide-static/icons/inbox.svg?raw';
import filter from 'lucide-static/icons/filter.svg?raw';
import externalLink from 'lucide-static/icons/external-link.svg?raw';
import award from 'lucide-static/icons/award.svg?raw';
import fileCheckTwo from 'lucide-static/icons/file-check-2.svg?raw';
import fileEdit from 'lucide-static/icons/file-edit.svg?raw';
import table from 'lucide-static/icons/table.svg?raw';
import sliders from 'lucide-static/icons/sliders.svg?raw';
import fileSpreadsheet from 'lucide-static/icons/file-spreadsheet.svg?raw';
import mapPin from 'lucide-static/icons/map-pin.svg?raw';
import globe from 'lucide-static/icons/globe.svg?raw';
import cpu from 'lucide-static/icons/cpu.svg?raw';
import code from 'lucide-static/icons/code.svg?raw';
import cog from 'lucide-static/icons/cog.svg?raw';
import eye from 'lucide-static/icons/eye.svg?raw';
import sun from 'lucide-static/icons/sun.svg?raw';
import moon from 'lucide-static/icons/moon.svg?raw';

const RAW = {
  'layout-dashboard': layoutDashboard, 'list-checks': listChecks, 'file-text': fileText, calendar,
  'line-chart': lineChart, printer, plus, 'plus-circle': plusCircle, pencil, 'edit-3': editThree,
  'trash-2': trash, download, search, x, 'circle-check': circleCheck, 'check-circle-2': checkCircleTwo,
  check, 'circle-alert': circleAlert, 'triangle-alert': triangleAlert, info, clock, users, target,
  'shield-check': shieldCheck, 'trending-up': trendingUp, 'chevron-left': chevronLeft, 'chevron-right': chevronRight,
  save, 'arrow-right': arrowRight, 'arrow-right-circle': arrowRightCircle, 'rotate-ccw': rotateCcw,
  'loader-circle': loaderCircle, cloud, 'cloud-off': cloudOff, link, unlink, 'log-out': logOut,
  'key-round': keyRound, database, inbox, filter, 'external-link': externalLink, award,
  'file-check-2': fileCheckTwo, 'file-edit': fileEdit, table, sliders, 'file-spreadsheet': fileSpreadsheet,
  'map-pin': mapPin, globe, cpu, code, cog, eye,
  sun, moon,
};

/** Devuelve el marcado SVG de un icono con clases CSS aplicadas. `name` debe existir en RAW. */
export function icon(name, className = 'w-4 h-4') {
  const svg = RAW[name];
  if (!svg) return '';
  return svg.replace('<svg ', `<svg class="${className}" `);
}
