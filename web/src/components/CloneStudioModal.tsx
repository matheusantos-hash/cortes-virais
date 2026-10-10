"use client";

import React from "react";
import dynamic from "next/dynamic";
import Modal from "./ui/Modal";

const CopyStyleStudio = dynamic(() => import("./CopyStyleStudio"), { ssr: false });

export interface CloneStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  projectId?: string;
  initialClip?: {
    id: string;
    title: string;
    path?: string | null;
    url?: string;
    position?: number;
    orientation?: string;
    verticalMode?: string;
  } | null;
  onCreated?: () => void;
}

export default function CloneStudioModal({
  isOpen,
  onClose,
  userId,
  projectId,
  initialClip,
  onCreated,
}: CloneStudioModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="840px"
    >
      <CopyStyleStudio
        userId={userId}
        projectId={projectId}
        initialClip={initialClip}
        isModal={true}
        onCreated={() => {
          if (onCreated) onCreated();
          onClose();
        }}
        onClose={onClose}
      />
    </Modal>
  );
}
