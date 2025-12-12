'use client';

import { FlowEditorPage } from '@/pages/FlowEditorPage';

export default function FlowEditor({ params }: { params: { id: string } }) {
  // Pasar params como prop si FlowEditorPage los necesita
  return <FlowEditorPage />;
}

