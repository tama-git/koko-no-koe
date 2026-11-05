import { Modal } from 'react-native';
import { PostDetailScreen } from '../screens/PostDetailScreen';

export function PostDetailModal({ postId, token, onClose }: { postId: number; token: string; onClose: () => void }) {
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <PostDetailScreen token={token} route={{ params: { postId } }} navigation={{ goBack: onClose }} />
    </Modal>
  );
}
