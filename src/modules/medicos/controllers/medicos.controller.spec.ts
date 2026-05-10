import { Test, TestingModule } from '@nestjs/testing';
import { MedicosController } from './medicos.controller';

describe('MedicosController', () => {
  let controller: MedicosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MedicosController],
    }).compile();

    controller = module.get<MedicosController>(MedicosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
