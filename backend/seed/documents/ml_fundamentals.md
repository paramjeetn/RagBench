# Machine Learning Fundamentals

## Gradient Descent

Gradient descent is an iterative first-order optimization algorithm used to find the minimum of a differentiable function. In machine learning, it is the primary method for minimizing a loss function by iteratively updating model parameters in the direction of the negative gradient.

The update rule is: θ = θ - α * ∇L(θ), where θ represents the parameters, α is the learning rate, and ∇L(θ) is the gradient of the loss function. The learning rate controls the step size — too large causes divergence, too small causes slow convergence.

**Variants of gradient descent** include:
- **Batch Gradient Descent**: Computes the gradient using the entire training dataset. Guaranteed to converge to the global minimum for convex functions, but computationally expensive for large datasets.
- **Stochastic Gradient Descent (SGD)**: Updates parameters using a single randomly selected training example. Much faster per iteration but introduces noise in the updates.
- **Mini-batch Gradient Descent**: A compromise that uses a small random subset (typically 32-256 examples) per update. This is the most commonly used variant in practice.

Modern optimizers like Adam, RMSProp, and AdaGrad build on gradient descent by adapting learning rates per parameter based on historical gradient information.

## Backpropagation

Backpropagation (backward propagation of errors) is the algorithm used to efficiently compute gradients of a loss function with respect to each weight in a neural network. It applies the chain rule of calculus layer by layer, starting from the output and working backward through the network.

The process works in two phases:
1. **Forward pass**: Input data flows through the network, and each layer computes its output. Intermediate activations are stored for use in the backward pass.
2. **Backward pass**: Starting from the loss, gradients are computed for each layer's weights by applying the chain rule. The gradient at each layer depends on the gradient flowing from the layer above and the local gradient of that layer's operation.

Backpropagation is efficient because it reuses intermediate computations — computing all gradients takes roughly the same time as two forward passes, regardless of the number of parameters. Without backpropagation, computing gradients numerically would require a separate forward pass for each parameter.

## Loss Functions

A loss function (also called a cost function or objective function) quantifies how well a model's predictions match the target values. The choice of loss function depends on the task:

- **Mean Squared Error (MSE)**: Used for regression tasks. Computes the average of squared differences between predictions and targets: L = (1/n) Σ(ŷᵢ - yᵢ)². Sensitive to outliers due to squaring.
- **Cross-Entropy Loss**: Used for classification tasks. Measures the difference between two probability distributions. For binary classification: L = -[y·log(ŷ) + (1-y)·log(1-ŷ)].
- **Hinge Loss**: Used in support vector machines. L = max(0, 1 - y·ŷ). Encourages a margin between classes.

The loss function defines the optimization landscape that gradient descent navigates. A well-chosen loss function aligns the optimization objective with the actual task goal.

## Overfitting and Underfitting

**Overfitting** occurs when a model learns to memorize the training data, including its noise and random fluctuations, rather than learning the underlying pattern. Signs of overfitting include high training accuracy but significantly lower validation/test accuracy. Common causes include model complexity that exceeds what the data warrants, insufficient training data, and training for too many epochs.

**Underfitting** occurs when a model is too simple to capture the underlying pattern in the data. Both training and test performance are poor. Causes include insufficient model capacity, excessive regularization, or inadequate training.

The **bias-variance trade-off** describes this tension: bias is the error from simplifying assumptions in the model (leading to underfitting), while variance is the sensitivity to small fluctuations in the training data (leading to overfitting). The total error decomposes into: Error = Bias² + Variance + Irreducible Noise.

## Regularization

Regularization encompasses techniques that constrain or penalize model complexity to prevent overfitting and improve generalization to unseen data.

**L1 Regularization (Lasso)**: Adds the sum of absolute values of weights to the loss: L_total = L_original + λΣ|wᵢ|. This encourages sparsity — many weights become exactly zero, effectively performing feature selection.

**L2 Regularization (Ridge)**: Adds the sum of squared weights to the loss: L_total = L_original + λΣwᵢ². This encourages small but non-zero weights, distributing the model's reliance across all features.

**Elastic Net**: Combines L1 and L2 penalties, offering a balance between sparsity and weight shrinkage.

**Dropout**: During training, randomly sets a fraction (typically 20-50%) of neuron activations to zero at each forward pass. This prevents co-adaptation of neurons — each neuron must learn features that are useful in combination with random subsets of other neurons. At inference time, all neurons are active but weights are scaled by the dropout probability.

**Early stopping**: Monitors validation performance during training and stops when it begins to degrade, even if training loss is still decreasing.

## Neural Network Architectures

**Convolutional Neural Networks (CNNs)**: Designed for processing grid-structured data like images. CNNs apply learnable filters (kernels) that slide across the input to detect local patterns such as edges, textures, and shapes. Key components include convolutional layers (local feature detection), pooling layers (spatial dimension reduction), and fully connected layers (final classification). The parameter sharing in convolutional layers makes CNNs much more parameter-efficient than fully connected networks for image tasks.

**Recurrent Neural Networks (RNNs)**: Process sequential data by maintaining a hidden state that carries information across time steps. Standard RNNs suffer from the vanishing gradient problem — gradients become extremely small as they are propagated back through many time steps, causing earlier layers to learn very slowly or stop learning entirely. LSTM (Long Short-Term Memory) and GRU (Gated Recurrent Unit) architectures address this with gating mechanisms that control information flow.

**Transformers**: Use self-attention mechanisms to process all positions in a sequence simultaneously, rather than sequentially like RNNs. The attention mechanism computes a weighted sum of value vectors, where weights are derived from the compatibility (dot product) between query and key vectors divided by the square root of the dimension. Multi-head attention runs multiple attention operations in parallel, allowing the model to attend to information from different representation subspaces. Transformers are the foundation of modern models like BERT, GPT, and T5.

## Key Concepts

**Transfer Learning**: The practice of reusing a model pre-trained on a large dataset (e.g., ImageNet for vision, or large text corpora for NLP) as the starting point for a related but different task. Fine-tuning involves updating some or all of the pre-trained weights on the new task's data. This is effective because early layers learn general features that transfer well across tasks.

**Batch Normalization**: Normalizes the activations within each mini-batch to have zero mean and unit variance, then applies a learned scale (γ) and shift (β). Benefits include faster training convergence, ability to use higher learning rates, and mild regularization effect. It reduces internal covariate shift — the phenomenon where the distribution of layer inputs changes during training as preceding layers are updated.

**Embeddings**: Dense, low-dimensional vector representations of discrete data such as words, categories, or items. Unlike one-hot encoding, embeddings capture semantic relationships — similar items have nearby representations in the embedding space. Word2Vec, GloVe, and modern contextual embeddings (BERT, GPT) are examples in NLP.

**Learning Rate Scheduling**: Adjusts the learning rate during training according to a predetermined schedule. Common strategies include step decay (reduce by a factor every N epochs), cosine annealing (smoothly decrease following a cosine curve), and warm-up followed by decay (start with a small learning rate, increase linearly, then decrease). Proper scheduling helps escape local minima early in training and fine-tune parameters later.
