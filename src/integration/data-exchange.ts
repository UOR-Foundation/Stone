import * as fs from 'fs';
import * as path from 'path';

/**
 * Interface defining a data exporter
 */
export interface DataExporter {
  id: string;
  name: string;
  description: string;
  formats: string[];
  exportData: (data: any, format: string, options?: any) => Promise<Buffer>;
}

/**
 * Interface defining a data importer
 */
export interface DataImporter {
  id: string;
  name: string;
  description: string;
  formats: string[];
  importData: (data: Buffer, format: string, options?: any) => Promise<any>;
}

/**
 * Class for managing data export and import
 */
export class DataExchangeManager {
  private exporters: Map<string, DataExporter> = new Map();
  private importers: Map<string, DataImporter> = new Map();

  /**
   * Registers a data exporter
   */
  registerExporter(exporter: DataExporter): void {
    if (this.exporters.has(exporter.id)) {
      throw new Error(`Exporter with ID "${exporter.id}" is already registered`);
    }

    this.exporters.set(exporter.id, exporter);
  }

  /**
   * Gets an exporter by ID
   */
  getExporter(id: string): DataExporter | undefined {
    return this.exporters.get(id);
  }

  /**
   * Registers a data importer
   */
  registerImporter(importer: DataImporter): void {
    if (this.importers.has(importer.id)) {
      throw new Error(`Importer with ID "${importer.id}" is already registered`);
    }

    this.importers.set(importer.id, importer);
  }

  /**
   * Gets an importer by ID
   */
  getImporter(id: string): DataImporter | undefined {
    return this.importers.get(id);
  }

  /**
   * Exports data using a specified exporter
   */
  async exportData(exporterId: string, data: any, format: string, options?: any): Promise<Buffer> {
    const exporter = this.getExporter(exporterId);
    if (!exporter) {
      throw new Error(`Exporter "${exporterId}" not found`);
    }

    if (!exporter.formats.includes(format)) {
      throw new Error(`Format "${format}" not supported by exporter "${exporterId}"`);
    }

    return await exporter.exportData(data, format, options);
  }

  /**
   * Imports data using a specified importer
   */
  async importData(importerId: string, data: Buffer, format: string, options?: any): Promise<any> {
    const importer = this.getImporter(importerId);
    if (!importer) {
      throw new Error(`Importer "${importerId}" not found`);
    }

    if (!importer.formats.includes(format)) {
      throw new Error(`Format "${format}" not supported by importer "${importerId}"`);
    }

    return await importer.importData(data, format, options);
  }

  /**
   * Exports data to a file
   */
  async exportToFile(exporterId: string, data: any, filePath: string, options?: any): Promise<void> {
    const format = path.extname(filePath).substring(1).toLowerCase();
    const exportedData = await this.exportData(exporterId, data, format, options);
    
    // Ensure directory exists
    const directory = path.dirname(filePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    
    fs.writeFileSync(filePath, exportedData);
  }

  /**
   * Imports data from a file
   */
  async importFromFile(importerId: string, filePath: string, options?: any): Promise<any> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const format = path.extname(filePath).substring(1).toLowerCase();
    const data = fs.readFileSync(filePath);
    
    return await this.importData(importerId, data, format, options);
  }

  /**
   * Gets all registered exporters
   */
  getAllExporters(): DataExporter[] {
    return Array.from(this.exporters.values());
  }

  /**
   * Gets all registered importers
   */
  getAllImporters(): DataImporter[] {
    return Array.from(this.importers.values());
  }

  /**
   * Unregisters an exporter by ID
   */
  unregisterExporter(id: string): boolean {
    return this.exporters.delete(id);
  }

  /**
   * Unregisters an importer by ID
   */
  unregisterImporter(id: string): boolean {
    return this.importers.delete(id);
  }
}

/**
 * Export necessary components
 */
export default {
  DataExchangeManager
};