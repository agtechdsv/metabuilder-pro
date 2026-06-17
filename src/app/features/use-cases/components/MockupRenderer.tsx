import { useUseCaseMockups } from '../hooks/useUseCaseMockups'
import { PesquisaCadastroMockup } from './mockups/PesquisaCadastroMockup'
import { CadastroMockup } from './mockups/CadastroMockup'
import { PesquisaMockup } from './mockups/PesquisaMockup'
import { MasterDetailMockup } from './mockups/MasterDetailMockup'
import { KanbanMockup } from './mockups/KanbanMockup'
import { MapaMentalMockup } from './mockups/MapaMentalMockup'
import { DashboardMockup } from './mockups/DashboardMockup'
import { AgendaMockup } from './mockups/AgendaMockup'
import { PersonalizadoMockup } from './mockups/PersonalizadoMockup'
import { GaleriaMockup } from './mockups/GaleriaMockup'
import { TimelineMockup } from './mockups/TimelineMockup'
import { GanttMockup } from './mockups/GanttMockup'
import { BlueprintMockup } from './mockups/BlueprintMockup'
import { MapMockup } from './mockups/MapMockup'

export function MockupRenderer({ selectedType, mockupsState }: { selectedType: string, mockupsState: ReturnType<typeof useUseCaseMockups> }) {
  return (
    <div className="w-full flex-grow">
      {selectedType === 'pesquisa_cadastro' && <PesquisaCadastroMockup mockupsState={mockupsState} />}
      {selectedType === 'cadastro' && <CadastroMockup mockupsState={mockupsState} />}
      {selectedType === 'pesquisa' && <PesquisaMockup mockupsState={mockupsState} />}
      {selectedType === 'master_detail' && <MasterDetailMockup mockupsState={mockupsState} />}
      {selectedType === 'kanban' && <KanbanMockup mockupsState={mockupsState} />}
      {selectedType === 'mapa_mental' && <MapaMentalMockup mockupsState={mockupsState} />}
      {selectedType === 'dashboard' && <DashboardMockup mockupsState={mockupsState} />}
      {selectedType === 'agenda' && <AgendaMockup mockupsState={mockupsState} />}
      {selectedType === 'personalizado' && <PersonalizadoMockup mockupsState={mockupsState} />}
      {selectedType === 'galeria' && <GaleriaMockup mockupsState={mockupsState} />}
      {selectedType === 'timeline' && <TimelineMockup mockupsState={mockupsState} />}
      {selectedType === 'gantt' && <GanttMockup mockupsState={mockupsState} />}
      {selectedType === 'blueprint' && <BlueprintMockup mockupsState={mockupsState} />}
      {selectedType === 'map' && <MapMockup mockupsState={mockupsState} />}
    </div>
  )
}
