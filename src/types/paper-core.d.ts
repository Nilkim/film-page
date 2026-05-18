// paper-core 경로에 대한 타입 선언.
// paper 패키지는 메인 entry(`paper`)에만 d.ts를 제공하므로
// paper-core 서브경로를 같은 타입으로 재노출.
declare module 'paper/dist/paper-core' {
  import paper from 'paper';
  export default paper;
}
