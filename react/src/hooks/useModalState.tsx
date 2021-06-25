import { useState } from "react";

export interface ModalState {
    open: boolean;
    onOpen: () => void;
    onClose: () => void;
}

/**
 * Simple hook for controlling Menu, Modal, Popover, etc. open/close states.
 */
export function useModalState(initialOpen?: boolean): ModalState {
    const [open, setOpen] = useState<boolean>(!!initialOpen);
    const onOpen = () => setOpen(true);
    const onClose = () => setOpen(false);

    return {
        open,
        onOpen,
        onClose,
    };
}
