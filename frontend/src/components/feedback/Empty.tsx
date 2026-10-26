interface EmptyProps {
  msg: string;
  ic?: string;
}

export function EmptyState({ msg, ic }: EmptyProps) {
  return (
    <div className="empty">
      {ic && <span className="ic">{ic}</span>}
      {msg}
    </div>
  );
}

export function EmptyRow({ cols, msg, ic = '📭' }: EmptyProps & { cols: number }) {
  return (
    <tr>
      <td colSpan={cols}>
        <EmptyState msg={msg} ic={ic} />
      </td>
    </tr>
  );
}
