import { formatDate } from "../lib/utils.js";

function Footer({ generatedAt, usageSkipped }) {
  return (
    <footer className="status-footer">
      <span>
        <i />
        Plasma Core: <strong>Live</strong>
      </span>
      <span>Skill Engine: local scan</span>
      <span>Data Sync: {formatDate(generatedAt)}</span>
      <span>{usageSkipped ? "Usage: opt-in" : "Usage: local only"}</span>
    </footer>
  );
}

export default Footer;
