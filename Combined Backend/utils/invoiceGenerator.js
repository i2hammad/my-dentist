// Generate invoice number in format: INV-YYMMDD-NNN
const generateInvoiceNumber = () => {
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
  return `INV-${yy}${mm}${dd}-${random}`;
};

module.exports = { generateInvoiceNumber };
