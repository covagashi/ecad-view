import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";

/**
 * Acciones que la vista activa aporta al menú del botón flotante de móvil
 * (páginas, dispositivos, piezas…). Así el lienzo no necesita barras ni
 * pestañas propias: todo lo que antes flotaba sobre él vive en el menú.
 */
export interface MobileAction {
  id: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  /** Contador opcional a la derecha (nº de páginas, de piezas…). */
  count?: number;
  onSelect: () => void;
}

const ActionsContext = createContext<MobileAction[]>([]);
const SetActionsContext = createContext<(actions: MobileAction[]) => void>(() => {});

export function MobileActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<MobileAction[]>([]);
  return (
    <SetActionsContext.Provider value={setActions}>
      <ActionsContext.Provider value={actions}>{children}</ActionsContext.Provider>
    </SetActionsContext.Provider>
  );
}

/** Acciones publicadas por la vista activa (las lee el botón flotante). */
export function useMobileActions(): MobileAction[] {
  return useContext(ActionsContext);
}

/**
 * Publica las acciones de la vista actual; se retiran al desmontarla. La lista
 * debe venir memoizada: su identidad es la dependencia del efecto.
 */
export function useProvideMobileActions(actions: MobileAction[]): void {
  const setActions = useContext(SetActionsContext);
  useEffect(() => {
    setActions(actions);
    return () => setActions([]);
  }, [setActions, actions]);
}
