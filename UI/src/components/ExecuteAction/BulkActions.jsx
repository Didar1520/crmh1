// ===== File: UI/src/components/ExecuteAction/BulkActions.jsx =====
import { Button, ButtonGroup } from 'react-bootstrap';

export default function BulkActions({
  total,
  selected,
  onSelectAll,
  onClear,
  onDelete
}) {
  return (
    <ButtonGroup size="sm" className="flex-wrap">
      <Button variant="outline-secondary" onClick={onSelectAll}>
        Выбрать все ({total})
      </Button>
      <Button
        variant="outline-secondary"
        onClick={onClear}
        disabled={!selected.size}
      >
        Снять выбор
      </Button>
      <Button
        variant="outline-danger"
        onClick={onDelete}
        disabled={!selected.size}
      >
        Удалить выбранные
      </Button>
    </ButtonGroup>
  );
}
