const CertificateService = require('../../src/services/CertificateService');
const CertificateRepository = require('../../src/repositories/CertificateRepository');

describe('CertificateService', () => {
  test('should extend BaseService', () => {
    const BaseService = require('../../src/services/BaseService');
    expect(CertificateService instanceof BaseService).toBe(true);
  });

  test('should have findAllWithDetails method', () => {
    expect(typeof CertificateService.findAllWithDetails).toBe('function');
  });

  test('should have findByIdWithDetails method', () => {
    expect(typeof CertificateService.findByIdWithDetails).toBe('function');
  });

  test('should have createCertificate method', () => {
    expect(typeof CertificateService.createCertificate).toBe('function');
  });

  test('should have verifyCertificate method', () => {
    expect(typeof CertificateService.verifyCertificate).toBe('function');
  });
});

describe('CertificateRepository', () => {
  const BaseRepository = require('../../src/repositories/BaseRepository');

  test('should extend BaseRepository', () => {
    expect(CertificateRepository instanceof BaseRepository).toBe(true);
  });

  test('should have findAllWithDetails method', () => {
    expect(typeof CertificateRepository.findAllWithDetails).toBe('function');
  });

  test('should have findByIdWithDetails method', () => {
    expect(typeof CertificateRepository.findByIdWithDetails).toBe('function');
  });

  test('should have findByCertificateNumber method', () => {
    expect(typeof CertificateRepository.findByCertificateNumber).toBe('function');
  });

  test('should have countWithFilters method', () => {
    expect(typeof CertificateRepository.countWithFilters).toBe('function');
  });
});
