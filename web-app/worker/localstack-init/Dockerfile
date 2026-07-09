FROM localstack/localstack:latest

COPY init-aws.sh /etc/localstack/init/ready.d/init-aws.sh
RUN sed -i 's/\r$//' /etc/localstack/init/ready.d/init-aws.sh \
  && chmod +x /etc/localstack/init/ready.d/init-aws.sh
