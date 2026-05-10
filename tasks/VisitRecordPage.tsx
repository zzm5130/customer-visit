import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layouts/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Mic, MicOff, Square, Play, Pause, Upload, CheckCircle2,
  Clock, Loader2, FileAudio, X, Save, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const VisitRecordPage: React.FC = () => {
  const { profile } = useAuth();

  // 录音状态
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // 上传状态
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [recordingStoragePath, setRecordingStoragePath] = useState<string | null>(null);

  // 拜访信息
  const [visitForm, setVisitForm] = useState({
    customerName: '',
    visitTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    visitLocation: '',
    visitPurpose: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [savedVisitId, setSavedVisitId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  // 开始录音
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach(t => t.stop());
        setRecordingState('stopped');
      };

      recorder.start(1000);
      setRecordingState('recording');
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } catch {
      toast.error('无法访问麦克风，请检查浏览器权限');
    }
  }, []);

  // 暂停录音
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      setRecordingState('paused');
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, []);

  // 继续录音
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setRecordingState('recording');
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
  }, []);

  // 停止录音
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, []);

  // 重新录音
  const resetRecording = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setRecordingState('idle');
    setUploaded(false);
    setRecordingStoragePath(null);
  }, [audioUrl]);

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/aac'];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|webm|m4a|aac|flac)$/i)) {
      toast.error('不支持的音频格式，请上传 MP3/WAV/OGG/WebM/AAC 格式文件');
      return;
    }

    setUploadFile(file);
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    setUploaded(false);
  };

  // 上传录音到Supabase Storage
  const uploadRecording = async (blobOrFile: Blob | File): Promise<string | null> => {
    if (!profile) return null;

    const ext = blobOrFile instanceof File
      ? blobOrFile.name.split('.').pop() || 'webm'
      : 'webm';
    const fileName = `${profile.id}/${Date.now()}_recording.${ext}`;

    setUploading(true);
    setUploadProgress(0);

    // 模拟进度（Supabase Storage不支持上传进度回调）
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => Math.min(prev + 10, 90));
    }, 200);

    try {
      const { error } = await supabase.storage
        .from('recordings')
        .upload(fileName, blobOrFile, {
          contentType: blobOrFile instanceof File ? blobOrFile.type : 'audio/webm',
        });

      clearInterval(progressInterval);

      if (error) throw error;

      setUploadProgress(100);
      setUploaded(true);
      setRecordingStoragePath(fileName);
      toast.success('录音上传成功');
      return fileName;
    } catch (err: unknown) {
      clearInterval(progressInterval);
      toast.error(`上传失败：${err instanceof Error ? err.message : '未知错误'}`);
      return null;
    } finally {
      setUploading(false);
    }
  };

  // 提交上传
  const handleUploadSubmit = async () => {
    const target = uploadFile || audioBlob;
    if (!target) {
      toast.error('请先录制或选择音频文件');
      return;
    }
    await uploadRecording(target);
  };

  // 保存拜访记录
  const handleSaveVisit = async () => {
    if (!visitForm.customerName.trim()) {
      toast.error('请填写客户名称');
      return;
    }

    setSaving(true);
    try {
      let currentStoragePath = recordingStoragePath;

      // 如果有录音但还没上传，先自动上传
      if (!currentStoragePath && (audioBlob || uploadFile)) {
        const target = uploadFile || audioBlob;
        if (target) {
          toast.info('正在自动上传录音...');
          currentStoragePath = await uploadRecording(target);
          if (!currentStoragePath) {
            throw new Error('录音自动上传失败，请手动尝试上传');
          }
        }
      }

      const fileName = uploadFile?.name || `录音_${format(new Date(), 'yyyyMMdd_HHmm')}.webm`;
      const payload = {
        user_id: profile!.id,
        customer_name: visitForm.customerName,
        visit_time: visitForm.visitTime ? new Date(visitForm.visitTime).toISOString() : null,
        visit_location: visitForm.visitLocation || null,
        visit_purpose: visitForm.visitPurpose || null,
        notes: visitForm.notes || null,
        recording_url: currentStoragePath || null,
        recording_name: currentStoragePath ? fileName : null,
        recording_duration: duration > 0 ? duration : null,
        status: currentStoragePath ? 'recording' as const : 'preparing' as const,
      };

      let visitId = savedVisitId;
      if (savedVisitId) {
        const { error } = await supabase.from('visits').update(payload).eq('id', savedVisitId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('visits').insert(payload).select('id').maybeSingle();
        if (error) throw error;
        visitId = data?.id || null;
        if (visitId) setSavedVisitId(visitId);
      }

      toast.success('拜访记录保存成功');
    } catch (err: unknown) {
      console.error('Save visit error:', err);
      toast.error(`保存失败：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 标题 */}
        <div className="flex items-center gap-2">
          <Mic size={20} className="text-destructive" />
          <h1 className="text-lg font-semibold">拜访中记录</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左：录音区域 */}
          <div className="space-y-4">
            {/* 录音控制 */}
            <Card className="border border-border shadow-none">
              <CardHeader className="pb-3 pt-4 px-5">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Mic size={14} className="text-destructive" />
                  实时录音
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                {/* 录音状态展示区 */}
                <div className="flex flex-col items-center py-6">
                  {/* 麦克风图标 */}
                  <div className={cn(
                    'w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-all duration-300',
                    recordingState === 'recording' ? 'bg-destructive/10 ring-4 ring-destructive/20' : 'bg-muted'
                  )}>
                    {recordingState === 'recording' ? (
                      <Mic size={32} className="text-destructive" />
                    ) : recordingState === 'stopped' ? (
                      <CheckCircle2 size={32} className="text-chart-2" />
                    ) : (
                      <MicOff size={32} className="text-muted-foreground" />
                    )}
                  </div>

                  {/* 波形动画 */}
                  {recordingState === 'recording' && (
                    <div className="flex items-end gap-1 mb-4 h-8">
                      {[14, 22, 18, 28, 20, 26, 16, 24, 18, 22].map((h, i) => (
                        <span key={i} className="wave-bar" style={{ height: `${h}px`, animationDelay: `${i * 0.08}s` }} />
                      ))}
                    </div>
                  )}

                  {/* 录音时长 */}
                  <div className="flex items-center gap-2 mb-4">
                    <Clock size={14} className="text-muted-foreground" />
                    <span className={cn(
                      'text-2xl font-mono font-medium',
                      recordingState === 'recording' ? 'text-destructive' : 'text-foreground'
                    )}>
                      {formatDuration(duration)}
                    </span>
                    {recordingState === 'recording' && (
                      <span className="flex h-2 w-2">
                        <span className="animate-ping absolute h-2 w-2 rounded-full bg-destructive opacity-75" />
                        <span className="rounded-full h-2 w-2 bg-destructive" />
                      </span>
                    )}
                  </div>

                  {/* 状态文字 */}
                  <div className="text-sm text-muted-foreground mb-6">
                    {recordingState === 'idle' && '准备录音'}
                    {recordingState === 'recording' && '录音中...'}
                    {recordingState === 'paused' && '已暂停'}
                    {recordingState === 'stopped' && `录音完成 · ${formatDuration(duration)}`}
                  </div>

                  {/* 控制按钮 */}
                  <div className="flex items-center gap-3">
                    {recordingState === 'idle' && (
                      <Button onClick={startRecording} className="px-6">
                        <Mic size={16} className="mr-2" />开始录音
                      </Button>
                    )}
                    {recordingState === 'recording' && (
                      <>
                        <Button variant="outline" onClick={pauseRecording}>
                          <Pause size={16} className="mr-2" />暂停
                        </Button>
                        <Button variant="destructive" onClick={stopRecording}>
                          <Square size={16} className="mr-2" />结束
                        </Button>
                      </>
                    )}
                    {recordingState === 'paused' && (
                      <>
                        <Button onClick={resumeRecording}>
                          <Play size={16} className="mr-2" />继续
                        </Button>
                        <Button variant="destructive" onClick={stopRecording}>
                          <Square size={16} className="mr-2" />结束
                        </Button>
                      </>
                    )}
                    {recordingState === 'stopped' && (
                      <Button variant="ghost" size="sm" onClick={resetRecording} className="text-muted-foreground">
                        <X size={14} className="mr-1" />重新录音
                      </Button>
                    )}
                  </div>
                </div>

                {/* 录音预览 */}
                {audioUrl && recordingState === 'stopped' && (
                  <div className="border border-border rounded p-3 bg-muted/20">
                    <audio controls src={audioUrl} className="w-full" style={{ height: '36px' }} />
                  </div>
                )}

                {duration < 5 && recordingState === 'stopped' && (
                  <div className="flex items-center gap-2 mt-3 text-xs text-warning">
                    <AlertCircle size={12} />
                    录音时长较短，建议重新录制
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 文件上传 */}
            <Card className="border border-border shadow-none">
              <CardHeader className="pb-3 pt-4 px-5">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Upload size={14} className="text-primary" />
                  上传录音文件
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-3">
                <div
                  className="border-2 border-dashed border-border rounded p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadFile ? (
                    <div className="flex items-center gap-3 justify-center">
                      <FileAudio size={20} className="text-primary" />
                      <span className="text-sm text-foreground truncate max-w-[200px]">{uploadFile.name}</span>
                    </div>
                  ) : (
                    <>
                      <Upload size={24} className="mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">点击选择录音文件</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">支持 MP3 / WAV / OGG / WebM / AAC</p>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />

                {/* 上传进度 */}
                {uploading && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>上传中...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-1.5" />
                  </div>
                )}

                {/* 文件预览 */}
                {audioUrl && uploadFile && (
                  <audio controls src={audioUrl} className="w-full" style={{ height: '36px' }} />
                )}

                {uploaded ? (
                  <div className="flex items-center gap-2 text-sm text-chart-2">
                    <CheckCircle2 size={14} />上传成功
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleUploadSubmit}
                    disabled={uploading || (!uploadFile && !audioBlob) || recordingState === 'recording'}
                  >
                    {uploading
                      ? <><Loader2 size={14} className="mr-2 animate-spin" />上传中...</>
                      : <><Upload size={14} className="mr-2" />上传到云端</>}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 右：拜访信息填写 */}
          <div>
            <Card className="border border-border shadow-none">
              <CardHeader className="pb-3 pt-4 px-5">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Save size={14} className="text-primary" />
                  拜访信息记录
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-normal">客户名称 <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="公司或客户姓名"
                    value={visitForm.customerName}
                    onChange={e => setVisitForm(prev => ({ ...prev, customerName: e.target.value }))}
                    className="px-3"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-normal">拜访时间</Label>
                  <Input
                    type="datetime-local"
                    value={visitForm.visitTime}
                    onChange={e => setVisitForm(prev => ({ ...prev, visitTime: e.target.value }))}
                    className="px-3"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-normal">拜访地点</Label>
                  <Input
                    placeholder="会议室/客户办公室/线上"
                    value={visitForm.visitLocation}
                    onChange={e => setVisitForm(prev => ({ ...prev, visitLocation: e.target.value }))}
                    className="px-3"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-normal">拜访目的</Label>
                  <Input
                    placeholder="产品演示/合同谈判/需求调研"
                    value={visitForm.visitPurpose}
                    onChange={e => setVisitForm(prev => ({ ...prev, visitPurpose: e.target.value }))}
                    className="px-3"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-normal">补充说明</Label>
                  <Textarea
                    placeholder="其他补充信息..."
                    value={visitForm.notes}
                    onChange={e => setVisitForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="px-3 resize-none"
                    rows={3}
                  />
                </div>

                <Separator />

                {/* 录音状态提示 */}
                <div className="flex items-center gap-2 text-xs">
                  {uploaded ? (
                    <Badge variant="secondary" className="text-chart-2 bg-chart-2/10">
                      <CheckCircle2 size={10} className="mr-1" />录音已上传
                    </Badge>
                  ) : recordingState === 'stopped' ? (
                    <Badge variant="secondary" className="text-warning bg-warning/10">
                      <AlertCircle size={10} className="mr-1" />录音待上传
                    </Badge>
                  ) : recordingState === 'recording' ? (
                    <Badge variant="secondary" className="text-destructive bg-destructive/10">
                      <span className="animate-pulse mr-1">●</span>录音中
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">尚未录音</span>
                  )}
                </div>

                <Button
                  className="w-full"
                  onClick={handleSaveVisit}
                  disabled={saving || recordingState === 'recording'}
                >
                  {saving
                    ? <><Loader2 size={14} className="mr-2 animate-spin" />保存中...</>
                    : savedVisitId
                      ? <><CheckCircle2 size={14} className="mr-2" />已保存（点击更新）</>
                      : <><Save size={14} className="mr-2" />保存拜访记录</>}
                </Button>

                {savedVisitId && (
                  <p className="text-xs text-center text-chart-2">
                    记录已保存，可在「拜访报告」中查看和处理
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default VisitRecordPage;
