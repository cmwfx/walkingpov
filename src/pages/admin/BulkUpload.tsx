import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { bulkUploadFromJson } from '@/lib/api';
import { Upload, ArrowLeft, FileJson, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface UploadResult {
  success: boolean;
  results: {
    successful: number;
    failed: number;
    errors: Array<{
      index: number;
      title: string;
      error: string;
    }>;
  };
}

export function BulkUpload() {
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.json')) {
        toast({
          title: 'Invalid file type',
          description: 'Please select a JSON file',
          variant: 'destructive',
        });
        return;
      }
      setJsonFile(file);
      setUploadResult(null); // Clear previous results
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!jsonFile) {
      toast({
        title: 'No file selected',
        description: 'Please select a JSON file to upload',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Read and parse JSON file
      const fileContent = await jsonFile.text();
      let videos;

      try {
        videos = JSON.parse(fileContent);
      } catch (parseError) {
        toast({
          title: 'Invalid JSON',
          description: 'The file contains invalid JSON. Please check the file format.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Ensure it's an array
      if (!Array.isArray(videos)) {
        toast({
          title: 'Invalid format',
          description: 'The JSON file must contain an array of video objects',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Upload to backend
      const result = await bulkUploadFromJson(videos);
      setUploadResult(result);

      if (result.success) {
        toast({
          title: 'Success!',
          description: `Successfully uploaded ${result.results.successful} video(s)`,
        });
      } else {
        toast({
          title: 'Partial Success',
          description: `Uploaded ${result.results.successful} video(s), ${result.results.failed} failed`,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload videos. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setJsonFile(null);
    setUploadResult(null);
    // Reset file input
    const fileInput = document.getElementById('json-file') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
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
            <FileJson className="h-6 w-6" />
            <CardTitle className="text-2xl">Bulk Upload from JSON</CardTitle>
          </div>
          <CardDescription>
            Upload multiple videos at once from a JSON file. Images will be downloaded and stored locally.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Instructions */}
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>JSON Format</AlertTitle>
            <AlertDescription>
              <p className="mb-2">Your JSON file should contain an array of video objects with the following structure:</p>
              <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`[
  {
    "title": "Video Title",
    "category": "Category Name",
    "downloads": [
      {
        "name": "GOFILE",
        "link": "https://gofile.io/..."
      }
    ],
    "images": [
      "https://example.com/image.jpg"
    ]
  }
]`}
              </pre>
            </AlertDescription>
          </Alert>

          {/* Upload Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="json-file" className="text-sm font-medium">
                Select JSON File *
              </label>
              <div className="flex items-center gap-4">
                <input
                  id="json-file"
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  className="flex-1 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                  disabled={loading}
                />
                {jsonFile && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileJson className="h-4 w-4" />
                    {jsonFile.name}
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Button 
                type="submit" 
                className="flex-1" 
                disabled={loading || !jsonFile}
              >
                {loading ? (
                  <>
                    <Upload className="h-4 w-4 mr-2 animate-pulse" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Videos
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={loading}
              >
                Reset
              </Button>
            </div>
          </form>

          {/* Upload Results */}
          {uploadResult && (
            <div className="mt-8 space-y-4">
              <h3 className="text-lg font-semibold">Upload Results</h3>
              
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <div>
                        <p className="text-sm text-muted-foreground">Successful</p>
                        <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                          {uploadResult.results.successful}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                      <div>
                        <p className="text-sm text-muted-foreground">Failed</p>
                        <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                          {uploadResult.results.failed}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Error Details */}
              {uploadResult.results.errors.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold mb-2 text-red-600 dark:text-red-400">
                    Failed Uploads ({uploadResult.results.errors.length})
                  </h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {uploadResult.results.errors.map((error, idx) => (
                      <Alert key={idx} variant="destructive">
                        <XCircle className="h-4 w-4" />
                        <AlertTitle>
                          #{error.index + 1}: {error.title}
                        </AlertTitle>
                        <AlertDescription className="text-xs">
                          {error.error}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions after upload */}
              <div className="flex gap-4 pt-4">
                <Button onClick={() => navigate('/admin')} variant="default">
                  Back to Dashboard
                </Button>
                <Button onClick={handleReset} variant="outline">
                  Upload Another File
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
