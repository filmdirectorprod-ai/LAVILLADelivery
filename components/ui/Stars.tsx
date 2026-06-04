// Gold star rating. Ported verbatim from the prototype (ui.jsx).
import { Icon } from './Icon';

export interface StarsProps {
  value: number;
  size?: number;
  showNum?: boolean;
  reviews?: number;
}

export function Stars({ value, size = 13, showNum = true, reviews }: StarsProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontFamily: 'var(--ui-font)',
      }}
    >
      <Icon name="star" size={size} color="var(--gold)" fill />
      <span style={{ fontSize: size, fontWeight: 600, color: 'var(--ink)' }}>
        {value.toFixed(1)}
      </span>
      {showNum && reviews != null && (
        <span style={{ fontSize: size - 1, color: 'var(--muted)' }}>({reviews})</span>
      )}
    </span>
  );
}
