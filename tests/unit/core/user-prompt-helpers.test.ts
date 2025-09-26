import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock enquirer
vi.mock('enquirer', () => ({
  default: { prompt: vi.fn() },
  prompt: vi.fn()
}));

import { promptUserConfirmation, promptUserAction } from '../../../src/core/command-runner';
import enquirer from 'enquirer';

describe('User Prompt Helpers', () => {
  let mockPrompt: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrompt = vi.mocked(enquirer.prompt);
  });

  describe('promptUserConfirmation', () => {
    it('should return true when user selects yes', async () => {
      mockPrompt.mockResolvedValue({ confirm: 'yes' });

      const result = await promptUserConfirmation('Are you sure?');

      expect(result).toBe(true);
      expect(mockPrompt).toHaveBeenCalledWith({
        type: 'select',
        name: 'confirm',
        message: 'Are you sure?',
        choices: [
          { name: 'yes', message: 'yes' },
          { name: 'no', message: 'no' }
        ],
        initial: 1 // Default to "no" for safety
      });
    });

    it('should return false when user selects no', async () => {
      mockPrompt.mockResolvedValue({ confirm: 'no' });

      const result = await promptUserConfirmation('Are you sure?');

      expect(result).toBe(false);
    });

    it('should default to "no" when defaultToNo is true', async () => {
      mockPrompt.mockResolvedValue({ confirm: 'no' });

      await promptUserConfirmation('Are you sure?', true);

      expect(mockPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          initial: 1 // "no" is at index 1
        })
      );
    });

    it('should default to "yes" when defaultToNo is false', async () => {
      mockPrompt.mockResolvedValue({ confirm: 'yes' });

      await promptUserConfirmation('Are you sure?', false);

      expect(mockPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          initial: 0 // "yes" is at index 0
        })
      );
    });

    it('should handle custom confirmation messages', async () => {
      const customMessage = 'Do you want to delete this item? This cannot be undone.';
      mockPrompt.mockResolvedValue({ confirm: 'yes' });

      const result = await promptUserConfirmation(customMessage);

      expect(result).toBe(true);
      expect(mockPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          message: customMessage
        })
      );
    });

    it('should handle very long confirmation messages', async () => {
      const longMessage = 'A'.repeat(500) + '?';
      mockPrompt.mockResolvedValue({ confirm: 'no' });

      const result = await promptUserConfirmation(longMessage);

      expect(result).toBe(false);
      expect(mockPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          message: longMessage
        })
      );
    });

    it('should handle messages with special characters', async () => {
      const specialMessage = 'Delete "User & Co." (ID: #123)? This action cannot be undone. (Y/n)';
      mockPrompt.mockResolvedValue({ confirm: 'yes' });

      const result = await promptUserConfirmation(specialMessage);

      expect(result).toBe(true);
      expect(mockPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          message: specialMessage
        })
      );
    });

    it('should handle unicode characters in messages', async () => {
      const unicodeMessage = '确定要删除此项目吗？';
      mockPrompt.mockResolvedValue({ confirm: 'no' });

      const result = await promptUserConfirmation(unicodeMessage);

      expect(result).toBe(false);
      expect(mockPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          message: unicodeMessage
        })
      );
    });

    it('should handle empty message', async () => {
      mockPrompt.mockResolvedValue({ confirm: 'yes' });

      const result = await promptUserConfirmation('');

      expect(result).toBe(true);
      expect(mockPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          message: ''
        })
      );
    });

    it('should use consistent prompt structure', async () => {
      mockPrompt.mockResolvedValue({ confirm: 'yes' });

      await promptUserConfirmation('Test message');

      expect(mockPrompt).toHaveBeenCalledWith({
        type: 'select',
        name: 'confirm',
        message: 'Test message',
        choices: [
          { name: 'yes', message: 'yes' },
          { name: 'no', message: 'no' }
        ],
        initial: 1
      });
    });
  });

  describe('promptUserAction', () => {
    it('should return selected action when user makes a choice', async () => {
      const choices = [
        { name: 'download', message: 'Download file' },
        { name: 'delete', message: 'Delete file' },
        { name: 'cancel', message: 'Cancel' }
      ];
      mockPrompt.mockResolvedValue({ action: 'download' });

      const result = await promptUserAction('What would you like to do?', choices);

      expect(result).toBe('download');
      expect(mockPrompt).toHaveBeenCalledWith({
        type: 'select',
        name: 'action',
        message: 'What would you like to do?',
        choices: choices
      });
    });

    it('should handle different action choices', async () => {
      const choices = [
        { name: 'artifacts', message: 'Download Artifacts' },
        { name: 'logs', message: 'Download Build Logs' },
        { name: 'continue', message: 'Continue without downloading' }
      ];
      mockPrompt.mockResolvedValue({ action: 'logs' });

      const result = await promptUserAction('Choose an option:', choices);

      expect(result).toBe('logs');
    });

    it('should handle single choice', async () => {
      const choices = [
        { name: 'proceed', message: 'Proceed with operation' }
      ];
      mockPrompt.mockResolvedValue({ action: 'proceed' });

      const result = await promptUserAction('Only option available:', choices);

      expect(result).toBe('proceed');
    });

    it('should handle choices with special characters', async () => {
      const choices = [
        { name: 'save&exit', message: 'Save & Exit' },
        { name: 'discard', message: 'Discard Changes' }
      ];
      mockPrompt.mockResolvedValue({ action: 'save&exit' });

      const result = await promptUserAction('What do you want to do?', choices);

      expect(result).toBe('save&exit');
    });

    it('should handle choices with unicode characters', async () => {
      const choices = [
        { name: 'save', message: '保存文件' },
        { name: 'cancel', message: '取消操作' }
      ];
      mockPrompt.mockResolvedValue({ action: 'save' });

      const result = await promptUserAction('选择操作:', choices);

      expect(result).toBe('save');
    });

    it('should handle empty choices array', async () => {
      const choices: { name: string, message: string }[] = [];
      mockPrompt.mockResolvedValue({ action: undefined });

      const result = await promptUserAction('No options available:', choices);

      expect(result).toBeUndefined();
      expect(mockPrompt).toHaveBeenCalledWith({
        type: 'select',
        name: 'action',
        message: 'No options available:',
        choices: choices
      });
    });

    it('should handle custom message with action choices', async () => {
      const customMessage = 'Please select your next action from the following options:';
      const choices = [
        { name: 'option1', message: 'First Option' },
        { name: 'option2', message: 'Second Option' }
      ];
      mockPrompt.mockResolvedValue({ action: 'option2' });

      const result = await promptUserAction(customMessage, choices);

      expect(result).toBe('option2');
      expect(mockPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          message: customMessage
        })
      );
    });

    it('should preserve choice structure integrity', async () => {
      const choices = [
        { name: 'complex-action', message: 'Complex Action with Details' },
        { name: 'simple', message: 'Simple' }
      ];
      mockPrompt.mockResolvedValue({ action: 'complex-action' });

      await promptUserAction('Select action:', choices);

      expect(mockPrompt).toHaveBeenCalledWith({
        type: 'select',
        name: 'action',
        message: 'Select action:',
        choices: choices
      });
    });

    it('should handle choices with very long messages', async () => {
      const choices = [
        { 
          name: 'long-option', 
          message: 'This is a very long option message that contains a lot of text to test how the system handles lengthy choice descriptions' 
        },
        { name: 'short', message: 'Short' }
      ];
      mockPrompt.mockResolvedValue({ action: 'long-option' });

      const result = await promptUserAction('Choose:', choices);

      expect(result).toBe('long-option');
    });
  });

  describe('Error Handling', () => {
    it('should handle enquirer prompt rejection in confirmation', async () => {
      mockPrompt.mockRejectedValue(new Error('User cancelled'));

      await expect(async () => {
        await promptUserConfirmation('Are you sure?');
      }).rejects.toThrow('User cancelled');
    });

    it('should handle enquirer prompt rejection in action selection', async () => {
      const choices = [{ name: 'test', message: 'Test' }];
      mockPrompt.mockRejectedValue(new Error('Prompt failed'));

      await expect(async () => {
        await promptUserAction('Choose:', choices);
      }).rejects.toThrow('Prompt failed');
    });

    it('should handle unexpected response format in confirmation', async () => {
      mockPrompt.mockResolvedValue({}); // No confirm property

      const result = await promptUserConfirmation('Test?');

      expect(result).toBe(false); // Should default to false for safety
    });

    it('should handle unexpected response format in action selection', async () => {
      const choices = [{ name: 'test', message: 'Test' }];
      mockPrompt.mockResolvedValue({}); // No action property

      const result = await promptUserAction('Choose:', choices);

      expect(result).toBeUndefined();
    });

    it('should handle null response in confirmation', async () => {
      mockPrompt.mockResolvedValue(null);

      await expect(async () => {
        await promptUserConfirmation('Test?');
      }).rejects.toThrow();
    });

    it('should handle null response in action selection', async () => {
      const choices = [{ name: 'test', message: 'Test' }];
      mockPrompt.mockResolvedValue(null);

      await expect(async () => {
        await promptUserAction('Choose:', choices);
      }).rejects.toThrow();
    });
  });

  describe('Integration Tests', () => {
    it('should work together for a complete user interaction flow', async () => {
      // First, ask for confirmation
      mockPrompt.mockResolvedValueOnce({ confirm: 'yes' });
      const confirmed = await promptUserConfirmation('Do you want to proceed?');
      
      expect(confirmed).toBe(true);
      
      // Then, ask for action choice
      const choices = [
        { name: 'download', message: 'Download' },
        { name: 'upload', message: 'Upload' }
      ];
      mockPrompt.mockResolvedValueOnce({ action: 'download' });
      const action = await promptUserAction('What next?', choices);
      
      expect(action).toBe('download');
      
      // Verify both prompts were called
      expect(mockPrompt).toHaveBeenCalledTimes(2);
    });

    it('should handle sequential confirmations', async () => {
      mockPrompt
        .mockResolvedValueOnce({ confirm: 'yes' })
        .mockResolvedValueOnce({ confirm: 'no' })
        .mockResolvedValueOnce({ confirm: 'yes' });

      const result1 = await promptUserConfirmation('First confirmation?');
      const result2 = await promptUserConfirmation('Second confirmation?');
      const result3 = await promptUserConfirmation('Third confirmation?');

      expect(result1).toBe(true);
      expect(result2).toBe(false);
      expect(result3).toBe(true);
      expect(mockPrompt).toHaveBeenCalledTimes(3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed choice objects', async () => {
      const malformedChoices = [
        { name: 'valid', message: 'Valid Choice' },
        { name: undefined, message: 'Invalid Name' }, // Invalid name
        { name: 'no-message' }, // Missing message
        null, // Null choice
        { message: 'No Name' } // Missing name
      ] as any;
      
      mockPrompt.mockResolvedValue({ action: 'valid' });

      const result = await promptUserAction('Choose:', malformedChoices);

      expect(result).toBe('valid');
    });

    it('should handle very large number of choices', async () => {
      const manyChoices = Array.from({ length: 100 }, (_, i) => ({
        name: `option${i}`,
        message: `Option ${i + 1}`
      }));
      
      mockPrompt.mockResolvedValue({ action: 'option50' });

      const result = await promptUserAction('Choose from many:', manyChoices);

      expect(result).toBe('option50');
    });

    it('should handle choices with duplicate names', async () => {
      const duplicateChoices = [
        { name: 'duplicate', message: 'First Duplicate' },
        { name: 'duplicate', message: 'Second Duplicate' },
        { name: 'unique', message: 'Unique Choice' }
      ];
      
      mockPrompt.mockResolvedValue({ action: 'duplicate' });

      const result = await promptUserAction('Choose:', duplicateChoices);

      expect(result).toBe('duplicate');
    });
  });
});