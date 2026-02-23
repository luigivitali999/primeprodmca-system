import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, AlertCircle } from 'lucide-react';
import { T, cardStyle } from '@/components/utils/theme';

export default function SocialReportForm({ creators, open, onClose, onSubmitSuccess }) {
  const [formData, setFormData] = useState({
    creator_id: '',
    platform: '',
    fake_username: '',
    fake_profile_url: '',
    violation_type: '',
    notes_internal: '',
  });
  const [screenshot, setScreenshot] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleScreenshotUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        setLoading(true);
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setScreenshot(file_url);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const creator = creators.find(c => c.id === formData.creator_id);
      await base44.entities.SocialReport.create({
        ...formData,
        creator_name: creator?.stage_name || '',
        date_reported: new Date().toISOString().split('T')[0],
        last_update: new Date().toISOString().split('T')[0],
        screenshot_url: screenshot || null,
      });
      onSubmitSuccess();
      resetForm();
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      creator_id: '',
      platform: '',
      fake_username: '',
      fake_profile_url: '',
      violation_type: '',
      notes_internal: '',
    });
    setScreenshot(null);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent style={{ ...cardStyle, background: '#0f172a' }}>
        <DialogHeader>
          <DialogTitle style={{ color: T.text }}>Nuova Segnalazione Social</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label style={{ color: T.textMuted, fontSize: 12 }}>Creator</Label>
            <Select value={formData.creator_id} onValueChange={(v) => setFormData({ ...formData, creator_id: v })}>
              <SelectTrigger style={{ background: '#0a1120', borderColor: 'rgba(99,102,241,0.2)', color: T.text }}>
                <SelectValue placeholder="Seleziona creator" />
              </SelectTrigger>
              <SelectContent>
                {creators.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.stage_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label style={{ color: T.textMuted, fontSize: 12 }}>Piattaforma</Label>
            <Select value={formData.platform} onValueChange={(v) => setFormData({ ...formData, platform: v })}>
              <SelectTrigger style={{ background: '#0a1120', borderColor: 'rgba(99,102,241,0.2)', color: T.text }}>
                <SelectValue placeholder="Seleziona piattaforma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Instagram">Instagram</SelectItem>
                <SelectItem value="TikTok">TikTok</SelectItem>
                <SelectItem value="X">X (Twitter)</SelectItem>
                <SelectItem value="Facebook">Facebook</SelectItem>
                <SelectItem value="Altro">Altro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label style={{ color: T.textMuted, fontSize: 12 }}>Username Falso</Label>
            <Input
              value={formData.fake_username}
              onChange={(e) => setFormData({ ...formData, fake_username: e.target.value })}
              placeholder="es. creator_official_2024"
              style={{ background: '#0a1120', borderColor: 'rgba(99,102,241,0.2)', color: T.text }}
            />
          </div>

          <div className="space-y-2">
            <Label style={{ color: T.textMuted, fontSize: 12 }}>Link Profilo Falso</Label>
            <Input
              value={formData.fake_profile_url}
              onChange={(e) => setFormData({ ...formData, fake_profile_url: e.target.value })}
              placeholder="https://instagram.com/..."
              style={{ background: '#0a1120', borderColor: 'rgba(99,102,241,0.2)', color: T.text }}
            />
          </div>

          <div className="space-y-2">
            <Label style={{ color: T.textMuted, fontSize: 12 }}>Tipo Violazione</Label>
            <Select value={formData.violation_type} onValueChange={(v) => setFormData({ ...formData, violation_type: v })}>
              <SelectTrigger style={{ background: '#0a1120', borderColor: 'rgba(99,102,241,0.2)', color: T.text }}>
                <SelectValue placeholder="Seleziona tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Impersonificazione">Impersonificazione</SelectItem>
                <SelectItem value="Copyright">Copyright</SelectItem>
                <SelectItem value="Scam">Scam</SelectItem>
                <SelectItem value="Altro">Altro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label style={{ color: T.textMuted, fontSize: 12 }}>Note Interne</Label>
            <Textarea
              value={formData.notes_internal}
              onChange={(e) => setFormData({ ...formData, notes_internal: e.target.value })}
              placeholder="Dettagli aggiuntivi..."
              className="h-20"
              style={{ background: '#0a1120', borderColor: 'rgba(99,102,241,0.2)', color: T.text }}
            />
          </div>

          <div className="space-y-2">
            <Label style={{ color: T.textMuted, fontSize: 12 }}>Screenshot (opzionale)</Label>
            <div className="flex items-center gap-2">
              <label className="flex-1 border-2 border-dashed rounded-lg p-3 cursor-pointer text-center"
                style={{ borderColor: 'rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.05)' }}>
                <Upload className="w-4 h-4 mx-auto mb-1" style={{ color: T.indigoSoft }} />
                <span style={{ fontSize: 12, color: T.textMuted }}>
                  {screenshot ? '✓ Upload completato' : 'Carica screenshot'}
                </span>
                <input type="file" onChange={handleScreenshotUpload} className="hidden" accept="image/*" />
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Annulla
            </Button>
            <Button
              type="submit"
              disabled={!formData.creator_id || !formData.platform || !formData.fake_username || loading}
              className="flex-1"
              style={{ background: '#6366f1' }}
            >
              {loading ? 'Caricamento...' : 'Crea Segnalazione'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}