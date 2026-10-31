/** html2canvas and jsPDF are big; they load only when a report is really made. */
type Pdf = typeof import('./pdf');
export const downloadReport = async (...a: Parameters<Pdf['downloadReport']>) => (await import('./pdf')).downloadReport(...a);
export const downloadCsv = async (...a: Parameters<Pdf['downloadCsv']>) => (await import('./pdf')).downloadCsv(...a);
export const staticMap = async (...a: Parameters<Pdf['staticMap']>) => (await import('./pdf')).staticMap(...a);
