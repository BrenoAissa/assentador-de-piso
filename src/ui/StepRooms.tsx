import PlanEditor from '../editor/PlanEditor';
import RoomPanel from '../editor/RoomPanel';

interface Props {
  detectSlot?: React.ReactNode;
  overlay?: React.ReactNode;
}

export default function StepRooms({ detectSlot, overlay }: Props) {
  return (
    <div className="workspace">
      <div style={{ position: 'relative', minHeight: 0, display: 'grid' }}>
        <PlanEditor />
        {overlay}
      </div>
      <RoomPanel detectSlot={detectSlot} />
    </div>
  );
}
