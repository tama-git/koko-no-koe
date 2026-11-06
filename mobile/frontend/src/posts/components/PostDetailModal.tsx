import { Modal } from 'react-native';
import { PostDetailScreen } from '../screens/PostDetailScreen';

export function PostDetailModal({ postId, token, onClose, onHidden }: { postId: number; token: string; onClose: () => void; onHidden?: () => void }) {
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <PostDetailScreen token={token} route={{ params: { postId } }} navigation={{ goBack: onClose }} onHidden={onHidden ?? onClose} />
    </Modal>
  );
}
