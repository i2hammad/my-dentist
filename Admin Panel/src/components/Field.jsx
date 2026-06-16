// Lightweight controlled form field used inside modals.
export default function Field({ label, type = 'text', value, onChange, options, placeholder, required }) {
  return (
    <div className="field">
      <label>{label}{required && <span style={{ color: '#EF4444' }}> *</span>}</label>
      {type === 'select' ? (
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => (
            <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
    </div>
  );
}
