// Generate a simple certificate-looking image to test extraction
import * as fs from 'fs';
import PDFDocument from 'pdfkit';
import path from 'path';

const out = 'D:/campus-ai-mentor-main/assets/test-cert.pdf';
const doc = new PDFDocument({ size: [800, 600], margin: 60 });
doc.pipe(fs.createWriteStream(out));
// decorative border
doc.lineWidth(6).strokeColor('#c0c1ff').rect(30, 30, 740, 540).stroke();
// header
doc.fontSize(28).fillColor('#1a1a2e').text('CERTIFICATE OF COMPLETION', { align: 'center' });
doc.moveDown(0.5);
doc.fontSize(14).fillColor('#333').text('To Whom It May Concern', { align: 'center' });
doc.moveDown(0.5);
doc.fontSize(16).fillColor('#222').text('This certificate proudly presented to', { align: 'center' });
doc.moveDown(0.3);
doc.fontSize(22).fillColor('#000').text('Anish Kumar', { align: 'center' });
doc.moveDown(0.5);
doc.fontSize(13).fillColor('#333').text('for successfully completing the "Python for Data Science" course', { align: 'center' });
doc.moveDown(0.3);
doc.fontSize(12).fillColor('#555').text('organized by Google Cloud Training', { align: 'center' });
doc.moveDown(1.2);
doc.fontSize(11).fillColor('#555').text('Authorized Signature', { align: 'right' });
doc.end();
console.log('wrote', out);