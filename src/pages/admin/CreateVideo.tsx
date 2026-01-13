import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { uploadThumbnail, createVideo } from '@/lib/api';
import { Plus, X, ArrowLeft, Video } from 'lucide-react';
import { Link } from 'react-router-dom';

interface DownloadLinkInput {
  label: string;
  url: string;
}

export function CreateVideo() {
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>('');
  const [downloadLinks, setDownloadLinks] = useState<DownloadLinkInput[]>([
    { label: '', url: '' },
  ]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setThumbnail(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnailPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const addDownloadLink = () => {
    setDownloadLinks([...downloadLinks, { label: '', url: '' }]);
  };

  const removeDownloadLink = (index: number) => {
    setDownloadLinks(downloadLinks.filter((_, i) => i !== index));
  };

  const updateDownloadLink = (index: number, field: 'label' | 'url', value: string) => {
    const updated = [...downloadLinks];
    updated[index][field] = value;
    setDownloadLinks(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!thumbnail) {
      toast({
        title: 'Thumbnail required',
        description: 'Please upload a thumbnail image',
        variant: 'destructive',
      });
      return;
    }

    const validLinks = downloadLinks.filter(link => link.label && link.url);
    if (validLinks.length === 0) {
      toast({
        title: 'Download links required',
        description: 'Please add at least one download link',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Upload thumbnail
      setUploading(true);
      const thumbnailUrl = await uploadThumbnail(thumbnail);
      setUploading(false);

      // Create video
      const tagsArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      
      await createVideo({
        title,
        thumbnail_url: thumbnailUrl,
        tags: tagsArray,
        download_links: validLinks,
      });

      toast({
        title: 'Success!',
        description: 'Video created successfully',
      });

      navigate('/admin');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create video. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Link to="/admin">
        <Button variant="ghost" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Admin
        </Button>
      </Link>

      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Video className="h-6 w-6" />
            <CardTitle className="text-2xl">Create New Video</CardTitle>
          </div>
          <CardDescription>
            Upload a video thumbnail and add download links
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Video Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter video title"
                required
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma separated)</Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="tutorial, programming, react"
              />
              <p className="text-sm text-muted-foreground">
                Separate tags with commas
              </p>
            </div>

            {/* Thumbnail Upload */}
            <div className="space-y-2">
              <Label htmlFor="thumbnail">Thumbnail Image *</Label>
              <div className="flex items-center gap-4">
                <Input
                  id="thumbnail"
                  type="file"
                  accept="image/*"
                  onChange={handleThumbnailChange}
                  className="flex-1"
                  required
                />
                {thumbnailPreview && (
                  <div className="relative w-32 h-20 rounded-lg overflow-hidden border">
                    <img
                      src={thumbnailPreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
              {uploading && (
                <p className="text-sm text-primary">Uploading thumbnail...</p>
              )}
            </div>

            {/* Download Links */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Download Links *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addDownloadLink}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Link
                </Button>
              </div>

              <div className="space-y-3">
                {downloadLinks.map((link, index) => (
                  <div key={index} className="flex gap-2 items-start p-4 border rounded-lg">
                    <div className="flex-1 space-y-2">
                      <Input
                        placeholder="Label (e.g., 1080p, 4K, Google Drive)"
                        value={link.label}
                        onChange={(e) => updateDownloadLink(index, 'label', e.target.value)}
                        required
                      />
                      <Input
                        placeholder="URL (https://...)"
                        value={link.url}
                        onChange={(e) => updateDownloadLink(index, 'url', e.target.value)}
                        required
                      />
                    </div>
                    {downloadLinks.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeDownloadLink(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Submit */}
            <div className="flex gap-4">
              <Button type="submit" className="flex-1" disabled={loading || uploading}>
                {loading ? 'Creating...' : uploading ? 'Uploading...' : 'Create Video'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/admin')}
                disabled={loading || uploading}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
