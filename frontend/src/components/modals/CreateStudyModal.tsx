import React, { useState } from 'react';
import { ModalDialog } from '../ui/Primitives';
import { FolderPlus } from 'lucide-react';

interface CreateStudyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { patient_anon_id: string; title: string; clinical_notes: string }) => Promise<void>;
}

export const CreateStudyModal: React.FC<CreateStudyModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [patientId, setPatientId] = useState<string>('PV-SUBJ-' + Math.floor(100 + Math.random() * 900));
  const [title, setTitle] = useState<string>('Thoracic CT Volumetric Evaluation');
  const [notes, setNotes] = useState<string>('Routine AI-assisted lung parenchyma & lobar volumetry');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({ patient_anon_id: patientId, title, clinical_notes: notes });
      onClose();
    } catch {
      // Error handled in parent
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Medical Imaging Study"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs text-[#F8FAFC]">
        <div>
          <label className="block text-xs font-semibold text-[#CBD5E1] mb-1.5">
            Anonymized Patient / Subject ID *
          </label>
          <input
            type="text"
            required
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            placeholder="e.g. PV-SUBJ-108"
            className="w-full px-3 py-2 text-xs font-mono bg-[#161F30] border border-[#222F43] rounded-lg text-[#FFFFFF] placeholder-[#64748B] focus:outline-none focus:border-[#38BDF8]"
          />
          <p className="text-[11px] text-[#94A3B8] mt-1 font-mono">
            HIPAA safe harbor compliant de-identified subject code.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#CBD5E1] mb-1.5">
            Study Protocol Title *
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. High-Resolution Thoracic CT Assessment"
            className="w-full px-3 py-2 text-xs bg-[#161F30] border border-[#222F43] rounded-lg text-[#FFFFFF] placeholder-[#64748B] focus:outline-none focus:border-[#38BDF8]"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#CBD5E1] mb-1.5">
            Clinical Research Notes
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Indication, scanner model, contrast status, or pulmonary pathology focus"
            className="w-full px-3 py-2 text-xs bg-[#161F30] border border-[#222F43] rounded-lg text-[#FFFFFF] placeholder-[#64748B] focus:outline-none focus:border-[#38BDF8]"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#222F43]">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs text-[#CBD5E1] hover:text-[#FFFFFF] bg-[#161F30] border border-[#222F43] rounded-lg transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0D9488] hover:bg-[#14B8A6] rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>{submitting ? 'Registering...' : 'Register Study'}</span>
          </button>
        </div>
      </form>
    </ModalDialog>
  );
};
