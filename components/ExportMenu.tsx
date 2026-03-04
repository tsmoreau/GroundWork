"use client";

import { useState, RefObject } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Image, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ExportMenuProps {
  mapContainerRef: RefObject<HTMLDivElement | null>;
  projectName: string;
}

export default function ExportMenu({ mapContainerRef, projectName }: ExportMenuProps) {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  const captureCanvas = async (): Promise<HTMLCanvasElement | null> => {
    try {
      const html2canvas = (await import("html2canvas")).default;
      if (!mapContainerRef.current) return null;
      const canvas = await html2canvas(mapContainerRef.current, {
        useCORS: true,
        allowTaint: true,
        scale: 2,
      });
      return canvas;
    } catch (err) {
      console.error("Export capture failed:", err);
      return null;
    }
  };

  const handleExportPNG = async () => {
    setExporting(true);
    try {
      const canvas = await captureCanvas();
      if (!canvas) {
        toast({ title: "Error", description: "Failed to capture view", variant: "destructive" });
        return;
      }
      const link = document.createElement("a");
      link.download = `${projectName}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast({ title: "PNG exported" });
    } catch {
      toast({ title: "Error", description: "Export failed", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const canvas = await captureCanvas();
      if (!canvas) {
        toast({ title: "Error", description: "Failed to capture view", variant: "destructive" });
        return;
      }
      const { jsPDF } = await import("jspdf");
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? "landscape" : "portrait",
        unit: "px",
        format: [canvas.width, canvas.height + 60],
      });
      pdf.setFontSize(20);
      pdf.text(projectName, 20, 35);
      pdf.addImage(imgData, "PNG", 0, 50, canvas.width, canvas.height);
      pdf.save(`${projectName}.pdf`);
      toast({ title: "PDF exported" });
    } catch {
      toast({ title: "Error", description: "Export failed", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={exporting}
          data-testid="button-export"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline ml-1">Export</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportPNG} data-testid="button-export-png">
          <Image className="w-4 h-4 mr-2" />
          Export as PNG
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportPDF} data-testid="button-export-pdf">
          <FileText className="w-4 h-4 mr-2" />
          Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
