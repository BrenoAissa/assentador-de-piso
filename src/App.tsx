import { useEffect } from 'react';
import { useDetection } from './detection/useDetection';
import { DetectControls, DetectOverlay } from './editor/DetectControls';
import { startAutosave, useProject } from './store/project';
import ProjectActions from './ui/ProjectActions';
import StepResult from './ui/StepResult';
import StepRooms from './ui/StepRooms';
import StepTile from './ui/StepTile';
import Stepper from './ui/Stepper';
import StepUpload from './ui/StepUpload';
import './ui/app.css';

export default function App() {
  const loaded = useProject((s) => s.loaded);
  const step = useProject((s) => s.step);

  useEffect(() => {
    void useProject.getState().loadFromStorage();
    return startAutosave();
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          Assentador de piso
        </div>
        <Stepper />
        <ProjectActions />
      </header>
      <main style={{ minHeight: 0, display: 'grid' }}>
        {!loaded ? (
          <div className="center-msg">Carregando o projeto…</div>
        ) : step === 1 ? (
          <StepUpload onPlanReady={(img) => useDetection.getState().run(img.blob)} />
        ) : step === 2 ? (
          <StepRooms detectSlot={<DetectControls />} overlay={<DetectOverlay />} />
        ) : step === 3 ? (
          <StepTile />
        ) : (
          <StepResult />
        )}
      </main>
    </div>
  );
}
