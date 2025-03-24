import { RepositoryAnalyzer } from '../../../src/config/analyzer';
import fs from 'fs';
import path from 'path';

jest.mock('fs');
jest.mock('path');

describe('RepositoryAnalyzer', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    
    // Mock path.join to return predictable paths
    (path.join as jest.Mock).mockImplementation((...paths) => paths.join('/'));
    
    // Mock path.basename to return the last segment of the path
    (path.basename as jest.Mock).mockImplementation((p) => p.split('/').pop());
  });

  test('analyzePackages detects monorepo structure with package.json files', async () => {
    const mockFs = fs as jest.Mocked<typeof fs>;
    
    // Mock packages directory existence
    mockFs.existsSync.mockImplementation((p) => {
      if (p === '/repo/packages') return true;
      if (p === '/repo/packages/pkg1/package.json') return true;
      if (p === '/repo/packages/pkg2/package.json') return true;
      return false;
    });
    
    // Mock directory structure
    mockFs.statSync.mockImplementation((p) => ({
      isDirectory: () => p === '/repo/packages' || p === '/repo/packages/pkg1' || p === '/repo/packages/pkg2',
    } as fs.Stats));
    
    // Mock packages directory contents
    mockFs.readdirSync.mockReturnValue(['pkg1', 'pkg2'] as unknown as fs.Dirent[]);
    
    // Mock package.json contents
    mockFs.readFileSync.mockImplementation((p) => {
      if (p === '/repo/packages/pkg1/package.json') return JSON.stringify({ name: 'pkg1-name' });
      if (p === '/repo/packages/pkg2/package.json') return JSON.stringify({ name: 'pkg2-name' });
      return '';
    });
    
    const analyzer = new RepositoryAnalyzer('/repo');
    const packages = await analyzer.analyzePackages();
    
    expect(packages).toEqual([
      {
        name: 'pkg1-name',
        path: 'packages/pkg1',
        team: 'team-pkg1',
      },
      {
        name: 'pkg2-name',
        path: 'packages/pkg2',
        team: 'team-pkg2',
      },
    ]);
  });

  test('analyzePackages handles packages without package.json', async () => {
    const mockFs = fs as jest.Mocked<typeof fs>;
    
    // Mock packages directory existence
    mockFs.existsSync.mockImplementation((p) => {
      if (p === '/repo/packages') return true;
      if (p === '/repo/packages/pkg1/package.json') return false;
      return false;
    });
    
    // Mock directory structure
    mockFs.statSync.mockImplementation((p) => ({
      isDirectory: () => p === '/repo/packages' || p === '/repo/packages/pkg1',
    } as fs.Stats));
    
    // Mock packages directory contents
    mockFs.readdirSync.mockReturnValue(['pkg1'] as unknown as fs.Dirent[]);
    
    const analyzer = new RepositoryAnalyzer('/repo');
    const packages = await analyzer.analyzePackages();
    
    expect(packages).toEqual([
      {
        name: 'pkg1',
        path: 'packages/pkg1',
        team: 'team-pkg1',
      },
    ]);
  });

  test('analyzePackages falls back to repo root when no packages directory', async () => {
    const mockFs = fs as jest.Mocked<typeof fs>;
    
    // Mock packages directory does not exist
    mockFs.existsSync.mockImplementation((p) => {
      if (p === '/repo/packages') return false;
      if (p === '/repo/package.json') return true;
      return false;
    });
    
    // Mock package.json contents
    mockFs.readFileSync.mockImplementation((p) => {
      if (p === '/repo/package.json') return JSON.stringify({ name: 'root-pkg' });
      return '';
    });
    
    const analyzer = new RepositoryAnalyzer('/repo');
    const packages = await analyzer.analyzePackages();
    
    expect(packages).toEqual([
      {
        name: 'root-pkg',
        path: '.',
        team: 'core-team',
      },
    ]);
  });

  test('detectTestFramework identifies jest from package.json', async () => {
    const mockFs = fs as jest.Mocked<typeof fs>;
    
    // Mock package.json existence
    mockFs.existsSync.mockReturnValue(true);
    
    // Mock package.json contents
    mockFs.readFileSync.mockReturnValue(JSON.stringify({
      devDependencies: {
        jest: '^26.0.0',
      },
    }));
    
    const analyzer = new RepositoryAnalyzer('/repo');
    const framework = await analyzer.detectTestFramework();
    
    expect(framework).toBe('jest');
  });

  test('detectTestFramework identifies mocha from package.json', async () => {
    const mockFs = fs as jest.Mocked<typeof fs>;
    
    // Mock package.json existence
    mockFs.existsSync.mockReturnValue(true);
    
    // Mock package.json contents
    mockFs.readFileSync.mockReturnValue(JSON.stringify({
      devDependencies: {
        mocha: '^8.0.0',
      },
    }));
    
    const analyzer = new RepositoryAnalyzer('/repo');
    const framework = await analyzer.detectTestFramework();
    
    expect(framework).toBe('mocha');
  });

  test('detectTestFramework defaults to jest when no framework found', async () => {
    const mockFs = fs as jest.Mocked<typeof fs>;
    
    // Mock package.json existence
    mockFs.existsSync.mockReturnValue(true);
    
    // Mock package.json contents with no test framework
    mockFs.readFileSync.mockReturnValue(JSON.stringify({
      devDependencies: {},
    }));
    
    const analyzer = new RepositoryAnalyzer('/repo');
    const framework = await analyzer.detectTestFramework();
    
    expect(framework).toBe('jest');
  });
});